import process from "node:process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { run } from "./cli.js";
import {
  buildArtifactFingerprint,
  clearHistory,
  historyPath,
  loadHistory,
  searchHistory,
  splitByHistory,
} from "./history.js";
import { runDoctor } from "./doctor.js";
import { errorDetails, resultEnvelope } from "./result.js";
import { extractVideoId } from "./urls.js";
import { VERSION } from "./version.js";
import { ensureFfmpeg, ensureYtDlp } from "./bootstrap.js";
import {
  buildMediaPlan,
  inspectMedia,
  searchMedia,
} from "./discovery.js";
import {
  createArtifactReceipt,
  verifyArtifactReceipt,
} from "./probe.js";
import { normalizeOptions, parseArgs } from "./ytDlp.js";
import {
  configToOptions,
  loadConfigReadOnly,
  resolveProfile,
} from "./config.js";

const VALUE_OPTIONS = new Set([
  "--clip",
  "--profile",
  "-o",
  "--output-dir",
  "-q",
  "--quality",
  "-f",
  "--fragments",
  "-j",
  "--jobs",
  "--template",
  "--max-height",
  "--downloader",
  "--downloader-args",
  "--max-filesize",
  "--subs",
  "--subtitles",
  "--auto-subs",
  "--auto-captions",
  "--job-id",
]);

const PASSTHROUGH_SUBCOMMANDS = new Set(["agent", "config"]);

export function runEntry(argv, defaults = {}) {
  return mainEntry(argv, defaults).catch((error) => {
    if (argv.includes("--json")) {
      console.log(JSON.stringify(resultEnvelope({
        command: "error",
        ok: false,
        error: errorDetails(error),
        version: VERSION,
      })));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }

    process.exitCode = error?.exitCode ?? 1;
  });
}

export async function mainEntry(argv, defaults = {}) {
  if (argv[0] === "inspect") {
    return runInspectCommand(argv.slice(1));
  }

  if (argv[0] === "search") {
    return runSearchCommand(argv.slice(1));
  }

  if (argv[0] === "plan") {
    return runPlanCommand(argv.slice(1), defaults);
  }

  if (argv[0] === "receipt") {
    return runReceiptCommand(argv.slice(1));
  }

  if (argv[0] === "verify") {
    return runVerifyCommand(argv.slice(1));
  }

  if (argv[0] === "history") {
    return runHistoryCommand(argv.slice(1));
  }

  if (argv[0] === "doctor") {
    return runDoctor({
      fix: argv.includes("--fix"),
      update: argv.includes("--update") || argv.includes("-U"),
      json: argv.includes("--json"),
    });
  }

  if (PASSTHROUGH_SUBCOMMANDS.has(argv[0])) {
    return run(argv, defaults);
  }

  const prepared = prepareDownloadArgv(argv);
  return run(prepared, defaults);
}

export function prepareDownloadArgv(argv) {
  const json = argv.includes("--json");
  const prepared = json
    ? argv.filter((arg) => arg !== "--print-command")
    : [...argv];

  // An explicit overwrite request cannot take effect if history skips the job
  // first. Insert the dedupe override before `--`, which marks the URL boundary.
  if (prepared.includes("--force-overwrite") && !prepared.includes("--redownload")) {
    const marker = prepared.indexOf("--");
    if (marker >= 0) prepared.splice(marker, 0, "--redownload");
    else prepared.push("--redownload");
  }

  return dedupePositionalUrls(prepared);
}

export function dedupePositionalUrls(argv) {
  const result = [];
  const seen = new Set();
  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      positionalOnly = true;
      result.push(arg);
      continue;
    }

    if (!positionalOnly && VALUE_OPTIONS.has(arg)) {
      result.push(arg);
      if (argv[index + 1] !== undefined) result.push(argv[++index]);
      continue;
    }

    if (!positionalOnly && arg.startsWith("-")) {
      result.push(arg);
      continue;
    }

    const key = extractVideoId(arg) ?? arg;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(arg);
    }
  }

  return result;
}

export function parseHistoryArgs(argv) {
  let clear = false;
  let json = false;
  let limit = 20;
  const query = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--clear") {
      clear = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--limit") {
      const raw = argv[++index];
      if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) < 1) {
        throw usageError("--limit requires a positive integer");
      }
      limit = Number(raw);
      continue;
    }

    if (arg.startsWith("-")) {
      throw usageError(`Unknown history option: ${arg}`);
    }

    query.push(arg);
  }

  if (clear && query.length > 0) {
    throw usageError("lyt history --clear cannot be combined with a search query");
  }

  return { clear, json, limit, query: query.join(" ") };
}

function runHistoryCommand(argv) {
  const options = parseHistoryArgs(argv);

  if (options.clear) {
    clearHistory();
    if (options.json) {
      console.log(JSON.stringify({
        schema: "lyt.history.v1",
        version: VERSION,
        command: "history.clear",
        ok: true,
        path: historyPath(),
      }));
    } else {
      console.log("Download history cleared.");
    }
    return;
  }

  const entries = searchHistory(loadHistory(), options.query);
  const visible = entries.slice(-options.limit);

  if (options.json) {
    console.log(JSON.stringify({
      schema: "lyt.history.v1",
      version: VERSION,
      command: "history.list",
      ok: true,
      query: options.query,
      total: entries.length,
      entries: visible,
      path: historyPath(),
    }));
    return;
  }

  if (entries.length === 0) {
    console.log(options.query
      ? `No history entries match "${options.query}".`
      : "No downloads recorded yet.");
    console.log(`(history file: ${historyPath()})`);
    return;
  }

  for (const entry of visible) {
    const when = String(entry.ts ?? "").replace("T", " ").slice(0, 16);
    const mode = (entry.mode ?? "?").padEnd(5);
    console.log(`${when}  ${mode}  ${entry.url ?? entry.id ?? "?"}`);
  }

  if (entries.length > options.limit) {
    console.log(`(${entries.length - options.limit} older entries not shown - use --limit <n>)`);
  }
}

async function runInspectCommand(argv) {
  const { json, values } = parseReadOnlyArgs(argv, { maxValues: 1 });
  const url = values[0];
  if (!url) throw usageError("Usage: lyt inspect [--json] <URL>");
  const command = await ensureYtDlp({ noDownload: true });
  const inspection = await inspectMedia(url, { command, version: VERSION });

  if (json) {
    console.log(JSON.stringify(inspection));
  } else {
    printInspection(inspection);
  }
}

async function runSearchCommand(argv) {
  let json = false;
  let limit = 10;
  const query = [];
  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      positionalOnly = true;
      continue;
    }
    if (!positionalOnly && arg === "--json") {
      json = true;
      continue;
    }
    if (!positionalOnly && arg === "--limit") {
      limit = argv[++index];
      if (limit === undefined) throw usageError("--limit requires a value");
      continue;
    }
    if (!positionalOnly && arg.startsWith("-")) {
      throw usageError(`Unknown search option: ${arg}`);
    }
    query.push(arg);
  }

  if (query.length === 0) {
    throw usageError("Usage: lyt search [--limit <1-50>] [--json] <query>");
  }

  const command = await ensureYtDlp({ noDownload: true });
  const result = await searchMedia(query.join(" "), {
    command,
    limit,
    version: VERSION,
  });

  if (json) {
    console.log(JSON.stringify(result));
  } else {
    for (const item of result.results) {
      const duration = item.durationSeconds == null
        ? ""
        : ` (${formatDuration(item.durationSeconds)})`;
      console.log(`${item.title ?? "Untitled"}${duration}`);
      console.log(`  ${item.channel ?? item.uploader ?? ""}`);
      console.log(`  ${item.url}`);
    }
  }
}

async function runPlanCommand(argv, defaults) {
  const json = argv.includes("--json");
  const parsed = parseArgs(argv.filter((arg) => arg !== "--json"));
  if (parsed.urls.length !== 1) {
    throw usageError("Usage: lyt plan [download options] [--json] <URL>");
  }
  if (parsed.options.watch || parsed.options.paste || parsed.options.interactive) {
    throw usageError("lyt plan requires one explicit URL");
  }

  const userConfig = loadConfigReadOnly();
  const profileName = parsed.options.profile ?? userConfig.profile ?? null;
  const profileOptions = profileName ? resolveProfile(profileName) : {};
  const options = normalizeOptions({
    ...defaults,
    ...configToOptions(userConfig),
    ...profileOptions,
    ...parsed.options,
    json: false,
  });
  const command = await ensureYtDlp({ noDownload: true });
  const inspection = await inspectMedia(parsed.urls[0], { command, version: VERSION });
  const artifact = buildArtifactFingerprint(options);
  const historyEntries = loadHistory();
  const historyMatch = findPlanHistoryMatch(
    parsed.urls[0],
    inspection.media.id,
    artifact.fingerprint,
    historyEntries,
  );
  const ffmpegRequired =
    options.mp3 ||
    options.normalize ||
    options.splitChapters ||
    options.embedThumbnail ||
    options.clips.length > 0 ||
    options.video;
  let ffmpegAvailable = null;
  if (ffmpegRequired) {
    try {
      await ensureFfmpeg({ noDownload: true });
      ffmpegAvailable = true;
    } catch {
      ffmpegAvailable = false;
    }
  }

  const plan = buildMediaPlan(inspection, {
    options,
    historyMatch,
    tools: { ytDlp: true, ffmpeg: ffmpegAvailable },
    version: VERSION,
  });

  if (json) {
    console.log(JSON.stringify(plan));
  } else {
    console.log(`${plan.media.title ?? plan.requestedUrl}`);
    console.log(`  recommendation: ${plan.recommendation}`);
    console.log(`  selection: ${plan.selection.strategy}`);
    console.log(`  output: ${plan.output.directory}`);
    console.log(`  estimated size: ${formatBytes(plan.estimate.bytes)}`);
    console.log("  plan side effects: metadata read only; no downloads, writes, or installs");
    console.log(
      `  approved download may install missing tools: ` +
        (plan.sideEffects.ifApproved.mayInstallMissingTools ? "yes" : "no"),
    );
  }
}

async function runReceiptCommand(argv) {
  let includeSha256 = false;
  let json = false;
  let output;
  const values = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--sha256") includeSha256 = true;
    else if (arg === "--json") json = true;
    else if (arg === "--output" || arg === "-o") {
      output = argv[++index];
      if (!output) throw usageError(`${arg} requires a file path`);
    } else if (arg.startsWith("-")) {
      throw usageError(`Unknown receipt option: ${arg}`);
    } else values.push(arg);
  }

  if (values.length !== 1) {
    throw usageError("Usage: lyt receipt [--sha256] [--output <receipt.json>] [--json] <file>");
  }

  const artifactPath = resolve(values[0]);
  const receipt = await createArtifactReceipt(artifactPath, {
    includeSha256,
  });
  const receiptPath = output ? resolve(output) : `${artifactPath}.lyt-receipt.json`;
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });

  if (json) {
    console.log(JSON.stringify({
      schema: "lyt.receipt-command.v1",
      version: VERSION,
      command: "receipt",
      ok: true,
      receiptPath,
      receipt,
    }));
  } else {
    console.log(`Receipt saved: ${receiptPath}`);
    console.log(`Assurance: ${receipt.assurance.strength} local integrity only`);
  }
}

async function runVerifyCommand(argv) {
  let json = false;
  let artifactPath;
  const values = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") json = true;
    else if (arg === "--file") {
      artifactPath = argv[++index];
      if (!artifactPath) throw usageError("--file requires a path");
    } else if (arg.startsWith("-")) {
      throw usageError(`Unknown verify option: ${arg}`);
    } else values.push(arg);
  }

  if (values.length !== 1) {
    throw usageError("Usage: lyt verify [--file <artifact>] [--json] <receipt.json>");
  }

  const receipt = JSON.parse(readFileSync(resolve(values[0]), "utf8"));
  const verification = await verifyArtifactReceipt(receipt, {
    artifactPath: artifactPath ? resolve(artifactPath) : undefined,
  });

  if (json) {
    console.log(JSON.stringify(verification));
  } else {
    const strong = verification.assurance.strength === "sha256";
    console.log(
      verification.ok
        ? strong
          ? "Verified local artifact size and SHA-256."
          : "Verified recorded local file size only (no SHA-256 was stored)."
        : "Local artifact verification failed.",
    );
    for (const check of verification.checks) {
      const marker = check.ok === true ? "[ok]" : check.ok === null ? "[--]" : "[!!]";
      console.log(`  ${marker} ${check.name}`);
    }
    console.log("This verifies local file integrity only, not remote authenticity.");
  }

  if (!verification.ok) process.exitCode = 1;
}

function parseReadOnlyArgs(argv, { maxValues }) {
  let json = false;
  const values = [];
  let positionalOnly = false;
  for (const arg of argv) {
    if (arg === "--") {
      positionalOnly = true;
    } else if (!positionalOnly && arg === "--json") {
      json = true;
    } else if (!positionalOnly && arg.startsWith("-")) {
      throw usageError(`Unknown option: ${arg}`);
    } else {
      values.push(arg);
    }
  }
  if (values.length > maxValues) throw usageError("Too many positional values");
  return { json, values };
}

function printInspection(inspection) {
  const { media, formats, captions } = inspection;
  console.log(media.title ?? inspection.requestedUrl);
  console.log(`  URL: ${media.webpageUrl ?? inspection.requestedUrl}`);
  console.log(`  duration: ${formatDuration(media.durationSeconds)}`);
  console.log(`  formats: ${formats.length}`);
  console.log(`  manual captions: ${captions.manual.map((item) => item.language).join(", ") || "none"}`);
  console.log(`  automatic captions: ${captions.automatic.map((item) => item.language).join(", ") || "none"}`);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "unknown";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "unavailable";
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function findPlanHistoryMatch(url, mediaId, fingerprint, entries) {
  const { skipped } = splitByHistory(
    [url],
    entries,
    undefined,
    fingerprint,
  );
  if (skipped.length === 0) return null;
  return [...entries].reverse().find(
    (entry) =>
      entry.id === mediaId &&
      entry.artifact === fingerprint,
  ) ?? null;
}

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}
