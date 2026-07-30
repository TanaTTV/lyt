import process from "node:process";
import { run } from "./cli.js";
import {
  clearHistory,
  historyPath,
  loadHistory,
  searchHistory,
} from "./history.js";
import { runDoctor } from "./doctor.js";
import { ensureYtDlp } from "./bootstrap.js";
import { fetchInfo } from "./info.js";
import { buildCapabilities } from "./capabilities.js";
import { errorDetails, resultEnvelope } from "./result.js";
import { extractVideoId } from "./urls.js";
import { VERSION } from "./version.js";

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

  if (argv[0] === "info" || argv[0] === "inspect") {
    return runInfoCommand(argv.slice(1));
  }

  if (argv[0] === "capabilities") {
    return runCapabilitiesCommand(argv.slice(1));
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

export function parseInfoArgs(argv) {
  let json = false;
  let noDownload = false;
  const urls = [];

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--no-download") {
      noDownload = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw usageError(`Unknown info option: ${arg}`);
    }

    urls.push(arg);
  }

  return { json, noDownload, urls };
}

async function runInfoCommand(argv) {
  const { json, noDownload, urls } = parseInfoArgs(argv);

  if (urls.length === 0) {
    throw usageError("Usage: lyt info <url> [more-urls...] [--json]");
  }

  const command = await ensureYtDlp({
    noDownload: noDownload || process.env.LYT_NO_DOWNLOAD === "1",
  });
  const results = [];

  for (const url of urls) {
    try {
      const media = await fetchInfo(url, { command });
      results.push({ url, status: "available", ...media });
      if (!json) printInfo(url, media);
    } catch (error) {
      results.push({ url, status: "failed", error: errorDetails(error) });
      if (!json) console.error(`- ${url}: ${error.message}`);
    }
  }

  if (json) {
    console.log(JSON.stringify({
      schema: "lyt.info.v1",
      version: VERSION,
      command: "info",
      ok: results.every((result) => result.status !== "failed"),
      results,
    }));
  }

  if (results.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

function printInfo(url, media) {
  console.log(media.title || url);

  const summary = [];
  if (media.uploader) summary.push(media.uploader);
  if (media.durationSeconds != null) summary.push(formatDuration(media.durationSeconds));
  if (media.extractor) summary.push(media.extractor);
  if (media.isLive) summary.push("LIVE");
  if (summary.length > 0) console.log(`  ${summary.join("  -  ")}`);

  if (media.heights.length > 0) {
    console.log(`  video: ${media.heights.map((height) => `${height}p`).join(", ")}`);
  }
  if (media.audioBitrates.length > 0) {
    console.log(`  audio: ${media.audioBitrates.map((rate) => `${rate}k`).join(", ")}`);
  }
  if (media.heights.length === 0 && media.audioBitrates.length === 0) {
    console.log("  no downloadable formats reported");
  }
  if (media.webpageUrl) console.log(`  url: ${media.webpageUrl}`);

  console.log("");
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

function runCapabilitiesCommand(argv) {
  const unknown = argv.find((arg) => arg.startsWith("-") && arg !== "--json");
  if (unknown) {
    throw usageError(`Unknown capabilities option: ${unknown}`);
  }

  const payload = buildCapabilities();

  if (argv.includes("--json")) {
    console.log(JSON.stringify(payload));
    return;
  }

  console.log(`lyt ${payload.version} (node ${payload.node})`);
  console.log("");
  console.log(`commands:  ${payload.commands.join(", ")}`);
  console.log(`modes:     ${payload.modes.join(", ")}`);
  console.log(`profiles:  ${payload.profiles.join(", ")}`);
  console.log(`schemas:   ${payload.schemas.join(", ")}`);
  console.log("");
  console.log("exit codes:");
  for (const [code, meaning] of Object.entries(payload.exitCodes)) {
    console.log(`  ${code}  ${meaning}`);
  }
  console.log("");
  console.log("options:");
  for (const option of payload.options) {
    const marker = option.takesValue ? " <value>" : "";
    console.log(`  ${option.flag}${marker}`.padEnd(26) + option.summary);
  }
  console.log("");
  console.log("Run `lyt capabilities --json` for the machine-readable manifest.");
}

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}
