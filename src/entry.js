import { createHash } from "node:crypto";
import { resolve } from "node:path";
import process from "node:process";
import { run } from "./cli.js";
import {
  clearHistory,
  historyPath,
  loadHistory,
  searchHistory,
} from "./history.js";
import {
  configToOptions,
  loadConfig,
  resolveProfile,
} from "./config.js";
import { runDoctor } from "./doctor.js";
import { errorDetails, resultEnvelope } from "./result.js";
import { extractVideoId } from "./urls.js";
import { normalizeOptions, parseArgs } from "./ytDlp.js";
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

  if (PASSTHROUGH_SUBCOMMANDS.has(argv[0])) {
    return run(argv, defaults);
  }

  const prepared = prepareDownloadArgv(argv);
  const artifact = buildArtifactFingerprint(prepared, defaults);
  const previousArtifact = process.env.LYT_ARTIFACT_FINGERPRINT;
  const previousMode = process.env.LYT_ARTIFACT_MODE;

  if (artifact) {
    process.env.LYT_ARTIFACT_FINGERPRINT = artifact.fingerprint;
    process.env.LYT_ARTIFACT_MODE = artifact.mode;
  }

  try {
    return await run(prepared, defaults);
  } finally {
    restoreEnv("LYT_ARTIFACT_FINGERPRINT", previousArtifact);
    restoreEnv("LYT_ARTIFACT_MODE", previousMode);
  }
}

export function prepareDownloadArgv(argv) {
  const json = argv.includes("--json");
  let prepared = json
    ? argv.filter((arg) => arg !== "--print-command")
    : [...argv];

  // An explicit overwrite request cannot take effect if history skips the job
  // first. Treat overwrite as an equally explicit request to bypass dedupe.
  if (prepared.includes("--force-overwrite") && !prepared.includes("--redownload")) {
    prepared = [...prepared, "--redownload"];
  }

  return dedupePositionalUrls(prepared);
}

export function buildArtifactFingerprint(argv, defaults = {}) {
  let parsed;

  try {
    parsed = parseArgs(argv);
  } catch {
    return null;
  }

  if (parsed.help || parsed.version || parsed.urls.length === 0 || parsed.options.listFormats) {
    return null;
  }

  const userConfig = loadConfig(undefined, { warn: () => {} });
  const profileName = parsed.options.profile ?? userConfig.profile ?? null;
  const profileOptions = profileName ? resolveProfile(profileName) : {};
  const options = normalizeOptions({
    ...defaults,
    ...configToOptions(userConfig),
    ...profileOptions,
    ...parsed.options,
  });

  const mode = options.video ? "video" : options.mp3 ? "mp3" : "audio";
  const variant = {
    schema: "lyt.artifact.v1",
    mode,
    quality: options.video
      ? options.maxHeight ?? "best"
      : options.mp3
        ? options.quality
        : "native",
    clips: options.clips,
    splitChapters: options.splitChapters,
    normalize: options.normalize,
    embedMetadata: options.embedMetadata,
    embedThumbnail: options.embedThumbnail,
    playlist: options.playlist,
    outputDir: resolve(options.outputDir),
    template: options.template,
  };

  const digest = createHash("sha256")
    .update(JSON.stringify(variant))
    .digest("hex")
    .slice(0, 24);

  return {
    fingerprint: `${variant.schema}:${digest}`,
    mode,
    variant,
  };
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

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function restoreEnv(name, previous) {
  if (previous === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}
