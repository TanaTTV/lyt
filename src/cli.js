import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import {
  buildYtDlpArgs,
  formatCommand,
  normalizeOptions,
  parseArgs,
  usage,
} from "./ytDlp.js";
import { promptForJob } from "./interactive.js";
import { createProgressRenderer, parseProgressLine } from "./progress.js";
import { listFormats } from "./formats.js";
import { labelHeight } from "./quality.js";
import { ensureYtDlp, ensureFfmpeg } from "./bootstrap.js";
import { readClipboard } from "./clipboard.js";
import { extractVideoId, extractYouTubeUrls } from "./urls.js";
import {
  clearHistory,
  existingHistoryFiles,
  historyPath,
  loadHistory,
  recordDownload,
  searchHistory,
  splitByHistory,
} from "./history.js";
import {
  assertConfigKey,
  configPath,
  configToOptions,
  loadConfig,
  resolveProfile,
  saveConfig,
} from "./config.js";
import { runDoctor } from "./doctor.js";
import { installAgentSkills } from "./agent.js";
import {
  errorDetails,
  extractOutputPath,
  outputCaptureArgs,
  resultEnvelope,
} from "./result.js";
import { VERSION } from "./version.js";

// Above this many URLs we skip the aggregated bar block (it would scroll the
// terminal) and fall back to yt-dlp's own inherited progress output.
const MAX_PROGRESS_BARS = 20;

// Clipboard polling cadence for --watch mode.
const WATCH_INTERVAL_MS = 1500;

export function run(argv, defaults = {}) {
  return main(argv, defaults).catch((error) => {
    if (argv.includes("--json") && !error?.jsonPrinted) {
      console.log(JSON.stringify(resultEnvelope({
        command: "error",
        ok: false,
        error: errorDetails(error),
        version: VERSION,
      })));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = (error && error.exitCode) ?? 1;
  });
}

export async function main(argv, defaults = {}) {
  // Subcommands take the first positional slot and never look like URLs.
  switch (argv[0]) {
    case "history":
      return runHistoryCommand(argv.slice(1));
    case "config":
      return runConfigCommand(argv.slice(1));
    case "doctor":
      return runDoctor({
        fix: argv.includes("--fix"),
        update: argv.includes("--update") || argv.includes("-U"),
      });
    case "agent":
      return runAgentCommand(argv.slice(1));
  }

  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  if (parsed.version) {
    console.log(`lyt ${VERSION}`);
    return;
  }

  // Option precedence (lowest to highest): entry-point defaults (yt4 ->
  // video), persistent config file, --profile bundle, explicit flags.
  const userConfig = loadConfig();
  const profileName = parsed.options.profile ?? userConfig.profile ?? null;
  const profileOptions = profileName ? resolveProfile(profileName) : {};
  parsed.options = {
    ...defaults,
    ...configToOptions(userConfig),
    ...profileOptions,
    ...parsed.options,
  };

  if (parsed.options.paste) {
    const fromClipboard = extractYouTubeUrls(readClipboard());

    if (fromClipboard.length === 0 && parsed.urls.length === 0 && !parsed.options.watch) {
      const error = new Error("No YouTube URLs found on the clipboard.");
      error.exitCode = 2;
      throw error;
    }

    parsed.urls = dedupeUrls([...parsed.urls, ...fromClipboard]);

    if (fromClipboard.length > 0) {
      console.error(`Picked up ${fromClipboard.length} URL(s) from the clipboard.`);
    }
  }

  const wantsInteractive =
    parsed.options.interactive ||
    (parsed.urls.length === 0 &&
      !parsed.options.watch &&
      process.stdin.isTTY &&
      !parsed.options.dryRun &&
      !parsed.options.printCommand &&
      !parsed.options.json);

  const noDownload =
    parsed.options.noDownload ?? process.env.LYT_NO_DOWNLOAD === "1";

  if (wantsInteractive) {
    const fetchFormats = async (url) =>
      listFormats(url, {
        command: await ensureYtDlp({ noDownload }),
      });

    const job = await promptForJob({ defaults: parsed.options, fetchFormats });

    if (!job) {
      return;
    }

    parsed.urls = job.urls;
    parsed.options = { ...parsed.options, ...job.options };
  }

  const options = normalizeOptions(parsed.options);
  const urls = parsed.urls;

  if (urls.length === 0 && !options.watch) {
    const error = new Error(`${usage()}\n\nMissing URL.`);
    error.exitCode = 2;
    throw error;
  }

  if (options.listFormats) {
    const command = await ensureYtDlp({ noDownload });
    const results = [];

    for (const url of urls) {
      try {
        const formats = await listFormats(url, { command });
        results.push({ url, status: "available", ...formats });
        if (!options.json) printFormats(url, formats);
      } catch (error) {
        results.push({ url, status: "failed", error: errorDetails(error) });
        if (!options.json) console.error(`- ${url}: ${error.message}`);
      }
    }

    if (options.json) {
      console.log(JSON.stringify(resultEnvelope({
        command: "formats",
        ok: results.every((result) => result.status !== "failed"),
        results,
        version: VERSION,
      })));
    }

    if (results.some((result) => result.status === "failed")) {
      process.exitCode = 1;
    }

    return;
  }

  if (options.dryRun) {
    const tools = { ytDlpCommand: "yt-dlp", ffmpegPath: null };
    const tasks = buildTasks(urls, options, tools, { capturePaths: false });

    if (options.json) {
      console.log(JSON.stringify(resultEnvelope({
        command: "dry-run",
        ok: true,
        results: tasks.map((task) => ({
          url: task.url,
          status: "planned",
          command: formatCommand(tools.ytDlpCommand, task.args),
          outputDir: resolve(options.outputDir),
        })),
        version: VERSION,
      })));
    } else {
      for (const task of tasks) {
        console.log(formatCommand(tools.ytDlpCommand, task.args));
      }
    }

    return;
  }

  const tools = await prepareTools(options, noDownload);

  if (options.watch) {
    if (options.json) {
      throw usageError("--json cannot be combined with --watch; use bounded URL batches.");
    }
    return runWatchMode(urls, options, tools);
  }

  const { failures, results } = await downloadUrls(urls, options, tools);

  if (options.json) {
    console.log(JSON.stringify(resultEnvelope({
      command: "download",
      ok: failures.length === 0,
      results,
      version: VERSION,
    })));
  }

  if (failures.length > 0) {
    const lines = failures.map(({ url, error }) => `- ${url}: ${error.message}`);
    const error = new Error(`Download failed:\n${lines.join("\n")}`);
    error.exitCode = 1;
    error.jsonPrinted = options.json;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Download machinery
// ---------------------------------------------------------------------------

async function prepareTools(options, noDownload) {
  const ytDlpCommand = await ensureYtDlp({ noDownload });

  // ffmpeg is needed for conversion, muxing, embedding, accurate clip cuts,
  // chapter splitting, and loudness normalization.
  const needsFfmpeg =
    options.mp3 ||
    options.video ||
    options.embedMetadata ||
    options.embedThumbnail ||
    options.normalize ||
    options.splitChapters ||
    options.clips.length > 0;
  const ffmpegPath = needsFfmpeg ? await ensureFfmpeg({ noDownload }) : null;

  return { ytDlpCommand, ffmpegPath };
}

// Downloads a batch of URLs. Returns the failures instead of throwing so
// watch mode can keep going after a bad link.
async function downloadUrls(urls, options, { ytDlpCommand, ffmpegPath }) {
  let targets = urls;
  const results = [];
  const historyEntries = options.history ? loadHistory() : [];

  // Instant dedupe against the download history (by video ID).
  if (!options.redownload && options.history) {
    const { fresh, skipped } = splitByHistory(urls, historyEntries);

    for (const url of skipped) {
      const id = extractVideoId(url);
      const previous = [...historyEntries].reverse().find((entry) => entry.id === id);
      results.push({
        url,
        videoId: id,
        status: "skipped",
        reason: "history",
        mode: previous?.mode ?? (options.video ? "video" : "audio"),
        files: existingHistoryFiles(previous),
        outputDir: resolve(previous?.dir ?? options.outputDir),
      });
      if (!options.json) {
        console.error(`Skipping (already downloaded): ${url}  - use --redownload to force`);
      }
    }

    targets = fresh;
  }

  if (targets.length === 0) {
    return { failures: [], results };
  }

  // Build each command exactly once and reuse it for both printing and
  // running so the printed command always matches what executes.
  const tasks = buildTasks(targets, options, { ffmpegPath });

  if (options.printCommand) {
    for (const task of tasks) {
      console.log(formatCommand(ytDlpCommand, task.args));
    }
  }

  await mkdir(options.outputDir, { recursive: true });

  const jobs = Math.min(options.jobs, targets.length);
  const queue = [...tasks];
  const failures = [];

  // The aggregated progress block is only worth its complexity when several
  // downloads share one TTY. A single download keeps yt-dlp's native progress
  // (inherited stdio), which is already clean and battle-tested.
  const useRenderer =
    jobs > 1 &&
    process.stderr.isTTY &&
    !options.printCommand &&
    targets.length <= MAX_PROGRESS_BARS;
  const renderer = useRenderer
    ? createProgressRenderer(tasks.map((task) => shortLabel(task.url)))
    : null;

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      const lineHandler = renderer
        ? (line) => {
            const info = parseProgressLine(line);

            if (info) {
              renderer.update(task.index, info);
            }
          }
        : undefined;

      try {
        const outcome = await runCommand(ytDlpCommand, task.args, {
          onLine: lineHandler,
          quiet: options.json,
        });

        if (outcome.files.length === 0) {
          renderer?.done(task.index, false);
          const guarded = Boolean(options.maxFilesize);
          const error = new Error(
            guarded
              ? `No file downloaded; media exceeded --max-filesize ${options.maxFilesize}.`
              : "yt-dlp completed without reporting a final output file.",
          );
          error.exitCode = 1;
          failures.push({ url: task.url, error });
          results.push({
            url: task.url,
            videoId: extractVideoId(task.url),
            status: guarded ? "skipped" : "failed",
            ...(guarded ? { reason: "max-filesize" } : { reason: "no-output" }),
            mode: options.video ? "video" : "audio",
            files: [],
            outputDir: resolve(options.outputDir),
            error: errorDetails(error),
          });
          continue;
        }

        renderer?.done(task.index, true);

        const result = {
          url: task.url,
          videoId: extractVideoId(task.url),
          status: "downloaded",
          mode: options.video ? "video" : "audio",
          files: outcome.files,
          outputDir: resolve(options.outputDir),
        };
        results.push(result);

        if (!options.json) {
          for (const file of outcome.files) {
            console.log(`Saved: ${file}`);
          }
        }

        if (options.history) {
          recordDownload({
            ts: new Date().toISOString(),
            id: extractVideoId(task.url),
            url: task.url,
            mode: options.video ? "video" : "audio",
            dir: resolve(options.outputDir),
            files: outcome.files,
          });
        }
      } catch (error) {
        renderer?.done(task.index, false);
        failures.push({ url: task.url, error });
        results.push({
          url: task.url,
          videoId: extractVideoId(task.url),
          status: "failed",
          mode: options.video ? "video" : "audio",
          files: [],
          outputDir: resolve(options.outputDir),
          error: errorDetails(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: jobs }, () => worker()));
  renderer?.finish();

  const order = new Map(urls.map((url, index) => [url, index]));
  results.sort((a, b) => (order.get(a.url) ?? 0) - (order.get(b.url) ?? 0));
  return { failures, results };
}

function buildTasks(urls, options, { ffmpegPath }, { capturePaths = true } = {}) {
  const tasks = urls.map((url, index) => {
    const args = buildYtDlpArgs(url, options);
    if (capturePaths) args.splice(args.indexOf("--"), 0, ...outputCaptureArgs());
    return { url, index, args };
  });

  // Tell yt-dlp where ffmpeg lives when it is not on PATH.
  if (ffmpegPath && ffmpegPath !== "ffmpeg") {
    for (const task of tasks) {
      task.args.splice(task.args.indexOf("--"), 0, "--ffmpeg-location", ffmpegPath);
    }
  }

  return tasks;
}

// --watch: poll the clipboard and download every new YouTube link the user
// copies until Ctrl+C. Pure Node polling — no external watcher process.
async function runWatchMode(initialUrls, options, tools) {
  const handled = new Set();
  let stopped = false;

  const stop = () => {
    stopped = true;
    process.stderr.write("\nStopped watching the clipboard.\n");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  console.error("Watching the clipboard for YouTube links - press Ctrl+C to stop.");

  const processBatch = async (urls) => {
    const fresh = urls.filter((url) => {
      const key = extractVideoId(url) ?? url;

      if (handled.has(key)) {
        return false;
      }

      handled.add(key);
      return true;
    });

    if (fresh.length === 0) {
      return;
    }

    const { failures } = await downloadUrls(fresh, options, tools);

    for (const { url, error } of failures) {
      console.error(`- ${url}: ${error.message}`);
    }
  };

  // Whatever is on the clipboard right now counts too — the user probably
  // copied it just before launching watch mode.
  await processBatch(dedupeUrls([...initialUrls, ...extractYouTubeUrls(readClipboard())]));

  while (!stopped) {
    await sleep(WATCH_INTERVAL_MS);

    if (stopped) {
      break;
    }

    await processBatch(extractYouTubeUrls(readClipboard()));
  }
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function runHistoryCommand(argv) {
  if (argv.includes("--clear")) {
    clearHistory();
    console.log("Download history cleared.");
    return;
  }

  const query = argv.filter((arg) => !arg.startsWith("-")).join(" ");
  const limitFlag = argv.indexOf("--limit");
  const limit = limitFlag >= 0 ? Number(argv[limitFlag + 1]) || 20 : 20;

  const entries = searchHistory(loadHistory(), query);

  if (entries.length === 0) {
    console.log(query ? `No history entries match "${query}".` : "No downloads recorded yet.");
    console.log(`(history file: ${historyPath()})`);
    return;
  }

  for (const entry of entries.slice(-limit)) {
    const when = String(entry.ts ?? "").replace("T", " ").slice(0, 16);
    const mode = (entry.mode ?? "?").padEnd(5);
    console.log(`${when}  ${mode}  ${entry.url ?? entry.id ?? "?"}`);
  }

  if (entries.length > limit) {
    console.log(`(${entries.length - limit} older entries not shown - use --limit <n>)`);
  }
}

function runConfigCommand(argv) {
  const [action, key, ...rest] = argv;
  const config = loadConfig();

  switch (action) {
    case "set": {
      if (!key || rest.length === 0) {
        throw usageError("Usage: lyt config set <key> <value>");
      }

      assertConfigKey(key);
      config[key] = rest.join(" ");
      saveConfig(config);
      console.log(`${key} = ${config[key]}`);
      return;
    }

    case "get": {
      if (!key) {
        throw usageError("Usage: lyt config get <key>");
      }

      assertConfigKey(key);
      console.log(config[key] !== undefined ? `${key} = ${config[key]}` : `${key} is not set`);
      return;
    }

    case "unset": {
      if (!key) {
        throw usageError("Usage: lyt config unset <key>");
      }

      assertConfigKey(key);
      delete config[key];
      saveConfig(config);
      console.log(`${key} unset`);
      return;
    }

    case "list":
    case undefined: {
      const keys = Object.keys(config);

      if (keys.length === 0) {
        console.log("No config values set. Try: lyt config set quality 320K");
      } else {
        for (const k of keys.sort()) {
          console.log(`${k} = ${config[k]}`);
        }
      }

      console.log(`(config file: ${configPath()})`);
      return;
    }

    case "path": {
      console.log(configPath());
      return;
    }

    default:
      throw usageError(
        `Unknown config action: ${action}. Use set, get, unset, list, or path.`,
      );
  }
}

function runAgentCommand(argv) {
  const [action = "install", ...args] = argv;

  if (action !== "install") {
    throw usageError("Usage: lyt agent install [codex|claude|all] [--home <dir>]");
  }

  let target = "all";
  let home;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--home") {
      if (!args[index + 1]) throw usageError("--home requires a directory");
      home = resolve(args[++index]);
    } else if (["codex", "claude", "all"].includes(args[index])) {
      target = args[index];
    } else {
      throw usageError(`Unknown agent install option: ${args[index]}`);
    }
  }

  const installed = installAgentSkills(target, { home });
  for (const { agent, destination } of installed) {
    console.log(`Installed lyt skill for ${agent}: ${destination}`);
  }
}

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupeUrls(urls) {
  const seen = new Set();
  const unique = [];

  for (const url of urls) {
    const key = extractVideoId(url) ?? url;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(url);
    }
  }

  return unique;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function runCommand(command, args, { onLine, quiet = false, cwd = process.cwd() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const recent = [];
    const files = [];
    const buffers = { stdout: "", stderr: "" };

    const feed = (stream, chunk) => {
      buffers[stream] += chunk;
      let newline;

      while ((newline = buffers[stream].indexOf("\n")) >= 0) {
        const line = buffers[stream].slice(0, newline).replace(/\r$/, "");
        buffers[stream] = buffers[stream].slice(newline + 1);
        handleLine(stream, line);
      }
    };

    const handleLine = (stream, line) => {
      const outputPath = extractOutputPath(line, cwd);

      if (outputPath) {
        if (!files.includes(outputPath)) files.push(outputPath);
        return;
      }

      onLine?.(line);

      if (!quiet && !onLine) {
        const writer = stream === "stdout" ? process.stdout : process.stderr;
        writer.write(`${line}\n`);
      }

      // Keep a few non-progress lines so a failure can show why.
      if (line.trim() && !line.startsWith("[download]")) {
        recent.push(line);
        if (recent.length > 8) recent.shift();
      }
    };

    child.stdout.setEncoding("utf8").on("data", (chunk) => feed("stdout", chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => feed("stderr", chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      for (const stream of ["stdout", "stderr"]) {
        if (buffers[stream]) handleLine(stream, buffers[stream].replace(/\r$/, ""));
      }
      settle(resolve, reject, command, code, recent, { files });
    });
  });
}

function settle(resolve, reject, command, code, recent = [], outcome = { files: [] }) {
  if (code === 0) {
    resolve(outcome);
    return;
  }

  const detail = recent.length > 0 ? `\n${recent.join("\n")}` : "";
  const error = new Error(`${command} exited with code ${code}${detail}`);
  error.exitCode = code;
  reject(error);
}

function printFormats(url, formats) {
  console.log(formats.title ? `${formats.title}` : url);

  if (formats.heights.length > 0) {
    const labels = formats.heights.map((height) => labelHeight(height));
    console.log(`  video: ${labels.join(", ")}`);
    const best = formats.heights[0];
    console.log(`  download best with: yt4 -q ${best}p -- "${url}"`);
  }

  if (formats.audioBitrates.length > 0) {
    console.log(`  audio: ${formats.audioBitrates.map((rate) => `${rate}k`).join(", ")}`);
  }

  if (formats.heights.length === 0 && formats.audioBitrates.length === 0) {
    console.log("  no downloadable formats reported");
  }

  console.log("");
}

function shortLabel(url) {
  const id = /[?&]v=([\w-]{6,})/.exec(url)?.[1] ?? /([\w-]{6,})$/.exec(url)?.[1];
  return id ?? url;
}

export function outputTemplate(outputDir, template) {
  return join(outputDir, template);
}

export function outputParent(outputPath) {
  return dirname(outputPath);
}
