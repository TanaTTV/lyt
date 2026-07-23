import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ensureFfprobe } from "./bootstrap.js";

export const ARTIFACT_RECEIPT_SCHEMA = "lyt.artifact-receipt.v1";
export const ARTIFACT_VERIFICATION_SCHEMA = "lyt.artifact-verification.v1";
export const LOCAL_INTEGRITY_SCOPE = "local-file-integrity-only";

export async function inspectLocalArtifact(filePath, {
  ffprobePath,
  runCommand = runCommandDefault,
} = {}) {
  if (!ffprobePath) {
    throw new Error("ffprobe is required to inspect media metadata");
  }

  const absolutePath = resolve(filePath);
  const result = await runCommand(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=format_name,duration:stream=codec_type,codec_name",
    "-of",
    "json",
    absolutePath,
  ]);

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (cause) {
    throw new Error(`ffprobe returned invalid JSON: ${cause.message}`);
  }

  return normalizeProbeResult(parsed);
}

export function normalizeProbeResult(payload) {
  const reportedFormats = String(payload?.format?.format_name ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const formats = uniqueSorted(reportedFormats);
  const duration = Number(payload?.format?.duration);
  const codecs = {
    audio: [],
    video: [],
    subtitle: [],
    other: [],
  };

  for (const stream of Array.isArray(payload?.streams) ? payload.streams : []) {
    const type = ["audio", "video", "subtitle"].includes(stream?.codec_type)
      ? stream.codec_type
      : "other";
    const codec = String(stream?.codec_name ?? "").trim();
    if (codec) codecs[type].push(codec);
  }

  for (const key of Object.keys(codecs)) {
    codecs[key] = uniqueSorted(codecs[key]);
  }

  return {
    container: {
      primary: reportedFormats[0] ?? null,
      formats,
    },
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
    codecs,
  };
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

export async function createArtifactReceipt(filePath, {
  includeSha256 = false,
  ffprobePath,
  toolPaths = {},
  runCommand = runCommandDefault,
  statFile = stat,
  hashFile = sha256File,
  locateFfprobe = locateFfprobeDefault,
  now = () => new Date(),
} = {}) {
  const absolutePath = resolve(filePath);
  const fileInfo = await statFile(absolutePath);
  assertRegularFile(fileInfo, absolutePath);

  const locatedFfprobe = ffprobePath ?? toolPaths.ffprobe ?? await locateFfprobe();
  let media = null;
  let mediaInspection = {
    available: false,
    error: locatedFfprobe ? "ffprobe inspection was not completed" : "ffprobe unavailable",
  };

  if (locatedFfprobe) {
    try {
      media = await inspectLocalArtifact(absolutePath, {
        ffprobePath: locatedFfprobe,
        runCommand,
      });
      mediaInspection = { available: true, error: null };
    } catch (error) {
      mediaInspection = {
        available: false,
        error: oneLine(error.message),
      };
    }
  }

  const requestedTools = {
    ...toolPaths,
    ...(locatedFfprobe ? { ffprobe: locatedFfprobe } : {}),
  };
  const tools = await collectToolVersions(requestedTools, { runCommand });
  const sha256 = includeSha256 ? await hashFile(absolutePath) : null;

  return {
    schema: ARTIFACT_RECEIPT_SCHEMA,
    createdAt: dateToIso(now()),
    assurance: {
      scope: LOCAL_INTEGRITY_SCOPE,
      remoteAuthenticityVerified: false,
      strength: sha256 ? "sha256" : "size-only",
    },
    artifact: {
      path: absolutePath,
      sizeBytes: Number(fileInfo.size),
      sha256,
      media,
    },
    inspection: mediaInspection,
    tools,
  };
}

export async function verifyArtifactReceipt(receipt, {
  artifactPath = receipt?.artifact?.path,
  statFile = stat,
  hashFile = sha256File,
} = {}) {
  validateReceipt(receipt);
  const absolutePath = resolve(artifactPath);
  const checks = [];
  let fileInfo;

  try {
    fileInfo = await statFile(absolutePath);
    assertRegularFile(fileInfo, absolutePath);
    checks.push({
      name: "file",
      ok: true,
      expected: "regular file",
      actual: "regular file",
    });
  } catch (error) {
    checks.push({
      name: "file",
      ok: false,
      expected: "regular file",
      actual: oneLine(error.message),
    });

    return verificationResult(receipt, absolutePath, checks);
  }

  checks.push({
    name: "size",
    ok: Number(fileInfo.size) === receipt.artifact.sizeBytes,
    expected: receipt.artifact.sizeBytes,
    actual: Number(fileInfo.size),
  });

  if (receipt.artifact.sha256) {
    try {
      const actualHash = await hashFile(absolutePath);
      checks.push({
        name: "sha256",
        ok: timingSafeTextEqual(actualHash, receipt.artifact.sha256),
        expected: receipt.artifact.sha256,
        actual: actualHash,
      });
    } catch (error) {
      checks.push({
        name: "sha256",
        ok: false,
        expected: receipt.artifact.sha256,
        actual: null,
        detail: `could not read artifact: ${oneLine(error.message)}`,
      });
    }
  } else {
    checks.push({
      name: "sha256",
      ok: null,
      expected: null,
      actual: null,
      detail: "not recorded; verification is limited to local file size",
    });
  }

  return verificationResult(receipt, absolutePath, checks);
}

export async function collectToolVersions(toolPaths, {
  runCommand = runCommandDefault,
} = {}) {
  const tools = {};

  for (const [name, path] of Object.entries(toolPaths ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!path) continue;
    try {
      const flag = name === "ffmpeg" || name === "ffprobe" ? "-version" : "--version";
      const result = await runCommand(path, [flag]);
      const version = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
        .split(/\r?\n/)[0]
        .trim();
      tools[name] = {
        path,
        version: version || null,
      };
    } catch (error) {
      tools[name] = {
        path,
        version: null,
        error: oneLine(error.message),
      };
    }
  }

  return tools;
}

function verificationResult(receipt, artifactPath, checks) {
  return {
    schema: ARTIFACT_VERIFICATION_SCHEMA,
    receiptSchema: receipt.schema,
    ok: checks.every((check) => check.ok !== false),
    assurance: {
      scope: LOCAL_INTEGRITY_SCOPE,
      remoteAuthenticityVerified: false,
      strength: receipt.artifact.sha256 ? "sha256" : "size-only",
    },
    artifact: {
      path: artifactPath,
    },
    checks,
  };
}

function validateReceipt(receipt) {
  if (receipt?.schema !== ARTIFACT_RECEIPT_SCHEMA) {
    throw new Error(`Unsupported artifact receipt schema: ${receipt?.schema ?? "(missing)"}`);
  }
  if (!receipt.artifact || typeof receipt.artifact.path !== "string") {
    throw new Error("Artifact receipt is missing artifact.path");
  }
  if (!Number.isSafeInteger(receipt.artifact.sizeBytes) || receipt.artifact.sizeBytes < 0) {
    throw new Error("Artifact receipt has an invalid artifact.sizeBytes");
  }
  if (
    receipt.artifact.sha256 != null &&
    !/^[a-f0-9]{64}$/.test(receipt.artifact.sha256)
  ) {
    throw new Error("Artifact receipt has an invalid artifact.sha256");
  }
}

function assertRegularFile(fileInfo, filePath) {
  if (typeof fileInfo?.isFile === "function" && !fileInfo.isFile()) {
    throw new Error(`Artifact is not a regular file: ${filePath}`);
  }
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function oneLine(value) {
  return String(value ?? "").split(/\r?\n/)[0];
}

function dateToIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Receipt timestamp is invalid");
  return date.toISOString();
}

function timingSafeTextEqual(left, right) {
  const a = String(left).toLowerCase();
  const b = String(right).toLowerCase();
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function locateFfprobeDefault() {
  try {
    return await ensureFfprobe({ noDownload: true });
  } catch {
    return null;
  }
}

function runCommandDefault(command, args) {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, {
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}
