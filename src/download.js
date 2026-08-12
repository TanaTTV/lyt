// Download engine: tool prep, batched URL jobs, and clipboard watch mode.

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { ensureYtDlp, ensureFfmpeg } from "./bootstrap.js";
import { readClipboard } from "./clipboard.js";
import {
  buildArtifactFingerprint,
  existingHistoryFiles,
  loadHistory,
  recordDownload,
  splitByHistory,
} from "./history.js";
import { createProgressRenderer, parseProgressLine } from "./progress.js";
import { runCommand } from "./process.js";
import { errorDetails, outputCaptureArgs } from "./result.js";
import { buildYtDlpArgs, formatCommand } from "./ytDlp.js";
import { dedupeUrlList, extractVideoId, extractYouTubeUrls } from "./urls.js";

// Above this many URLs we skip the aggregated bar block (it would scroll the
// terminal) and fall back to per-line progress without multi-job bars.
const MAX_PROGRESS_BARS = 20;

// Clipboard polling cadence for --watch mode.
const WATCH_INTERVAL_MS = 1500;

export async function prepareTools(options, noDownload) {
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
export async function downloadUrls(urls, options, { ytDlpCommand, ffmpegPath }) {
  const artifact = buildArtifactFingerprint(options);
  let targets = urls;
  const results = [];
  const historyEntries = options.history ? loadHistory() : [];

  // Instant dedupe against the download history (by video ID).
  if (!options.redownload && options.history) {
    const { fresh, skipped } = splitByHistory(
      urls,
      historyEntries,
      undefined,
      artifact.fingerprint,
    );

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

  // Multi-job TTY progress only; single jobs stream yt-dlp lines via runCommand.
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
          recordDownload(
            {
              ts: new Date().toISOString(),
              id: extractVideoId(task.url),
              url: task.url,
              mode: options.video ? "video" : "audio",
              dir: resolve(options.outputDir),
              files: outcome.files,
            },
            undefined,
            { artifact: artifact.fingerprint },
          );
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

export function buildTasks(urls, options, { ffmpegPath }, { capturePaths = true } = {}) {
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
export async function runWatchMode(initialUrls, options, tools) {
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
  await processBatch(dedupeUrlList([...initialUrls, ...extractYouTubeUrls(readClipboard())]));

  while (!stopped) {
    await sleep(WATCH_INTERVAL_MS);

    if (stopped) {
      break;
    }

    await processBatch(extractYouTubeUrls(readClipboard()));
  }
}

function shortLabel(url) {
  return extractVideoId(url) ?? url;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
