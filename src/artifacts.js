import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveExecutableOnPath } from "./executables.js";
import { taggedError } from "./failures.js";
import { runJsonTool } from "./jsonProcess.js";

export function findFfprobe(ffmpegPath, resolveExecutable = resolveExecutableOnPath) {
  const onPath = resolveExecutable("ffprobe");
  if (onPath) return onPath;
  if (!ffmpegPath || ffmpegPath === "ffmpeg") return null;
  return resolveExecutable(join(dirname(ffmpegPath), process.platform === "win32" ? "ffprobe.exe" : "ffprobe"));
}

export async function inspectArtifact(file, {
  ffprobePath = null, mode, statFile = stat, probe = runJsonTool,
} = {}) {
  let info;
  try { info = await statFile(file); }
  catch (cause) {
    throw taggedError(`Final output could not be inspected: ${file}`, "verification_failed", { cause });
  }
  if (!info.isFile() || info.size <= 0) {
    throw taggedError(`Final output is not a nonempty regular file: ${file}`, "verification_failed");
  }
  const receipt = { path: file, sizeBytes: info.size, verification: { status: "file-only", reason: "ffprobe_missing" } };
  if (!ffprobePath) return receipt;

  let payload;
  try {
    payload = await probe(ffprobePath, [
      "-v", "error", "-show_format", "-show_streams", "-show_program_version",
      "-protocol_whitelist", "file,pipe",
      "-of", "json", "-i", file,
    ], { timeoutMs: 10_000, maxBytes: 1024 * 1024 });
  } catch (cause) {
    // A timeout or an unusable optional executable is not proof of corrupt media.
    if (cause.kind === "network" || ["ENOENT", "EACCES", "EPERM", "EINVAL"].includes(cause.code)) {
      receipt.verification.reason = cause.kind === "network" ? "probe_timeout" : "probe_unavailable";
      return receipt;
    }
    throw taggedError(`Media inspection failed for retained file: ${file}`, "verification_failed", { cause });
  }
  const streams = (Array.isArray(payload.streams) ? payload.streams : [])
    .filter((stream) => ["audio", "video"].includes(stream.codec_type) && !stream.disposition?.attached_pic)
    .map((stream) => ({
      type: stream.codec_type, codec: typeof stream.codec_name === "string" ? stream.codec_name : null,
      ...(stream.codec_type === "video" ? { width: stream.width ?? null, height: stream.height ?? null } : {}),
      ...(stream.codec_type === "audio" ? { sampleRate: finiteNumber(stream.sample_rate), channels: stream.channels ?? null } : {}),
    }));
  if (streams.length === 0 || (mode && !streams.some((stream) => stream.type === mode))) {
    throw taggedError(`Retained file has no ${mode ?? "audio or video"} stream: ${file}`, "verification_failed");
  }
  return {
    ...receipt,
    container: typeof payload.format?.format_name === "string" ? payload.format.format_name : null,
    durationSeconds: finiteNumber(payload.format?.duration),
    streams,
    verification: { status: "verified", tool: "ffprobe", version: payload.program_version?.version ?? null },
  };
}

export async function inspectArtifacts(files, options = {}) {
  if (files.length === 0) throw taggedError("No final files are available to verify.", "verification_failed");
  const artifacts = [];
  let failure;
  for (const file of files) {
    try { artifacts.push(await inspectArtifact(file, options)); }
    catch (error) {
      // Preserve every path and individual receipt when any item fails verification.
      artifacts.push({ path: file, verification: { status: "failed" } });
      failure ??= error;
    }
  }
  if (failure) { failure.artifacts = artifacts; throw failure; }
  return artifacts;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
