// Download engine: tool prep, batched URL jobs, and clipboard watch mode.
//
// A job item is either a URL string or a target object from an expander such
// as Spotify: { url, template, matchFilter, fallbackUrl, metadata, cover,
// spotifyTrackId, source, label }.

import { readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import process from "node:process";
import { ensureYtDlp, ensureFfmpeg } from "./bootstrap.js";
import { readClipboard } from "./clipboard.js";
import { COVER_EXTENSIONS, embedCover } from "./cover.js";
import {
  buildArtifactFingerprint,
  existingHistoryFiles,
  loadHistory,
  matchHistory,
  recordDownload,
} from "./history.js";
import { createProgressRenderer, parseProgressLine } from "./progress.js";
import { MAX_DOWNLOADS_REACHED, runCommand } from "./process.js";
import { errorDetails, outputCaptureArgs } from "./result.js";
import { fetchTrackCover, isSpotifyUrl } from "./spotify.js";
import { err, muted, ok, warn } from "./ui.js";
import { buildYtDlpArgs, formatCommand } from "./ytDlp.js";
import { dedupeUrlList, describeCollectionUrl, extractMediaUrls, extractVideoId, urlKey } from "./urls.js";

// Above this many URLs we skip the aggregated bar block (it would scroll the
// terminal) and fall back to per-line progress without multi-job bars.
const MAX_PROGRESS_BARS = 20;

// Clipboard polling cadence for --watch mode.
const WATCH_INTERVAL_MS = 1500;

export function needsFfmpeg(options, items = []) {
  // ffmpeg is needed for conversion, muxing, embedding, accurate clip cuts,
  // chapter splitting, loudness normalization, subtitle conversion, and
  // SponsorBlock cuts. Spotify songs are tagged and get cover art.
  return Boolean(
    options.mp3 ||
      options.video ||
      options.embedMetadata ||
      options.embedThumbnail ||
      options.normalize ||
      options.splitChapters ||
      options.subs ||
      options.sponsorblock ||
      options.clips.length > 0 ||
      items.some((item) => typeof item === "object" && item?.metadata),
  );
}

export async function prepareTools(options, noDownload, items = []) {
  const ytDlpCommand = await ensureYtDlp({ noDownload });
  const ffmpegPath = needsFfmpeg(options, items) ? await ensureFfmpeg({ noDownload }) : null;
  return { ytDlpCommand, ffmpegPath };
}

// Downloads a batch of items. Returns the failures instead of throwing so
// watch mode can keep going after a bad link. `resultFor` maps each item to
// its result (used to write Spotify playlist files).
export async function downloadUrls(items, options, tools, {
  execute = runCommand,
  embed = embedCover,
  lookupCover = fetchTrackCover,
} = {}) {
  const artifact = buildArtifactFingerprint(options);
  const indexed = items.map((item, index) => ({ item, index, url: itemUrl(item) }));
  const results = [];
  const resultFor = new Map();
  const historyEntries = options.history ? loadHistory() : [];
  let targets = indexed;

  const addResult = (entry, result) => {
    results.push({ index: entry.index, result });
    resultFor.set(entry.item, result);
  };

  // Instant dedupe against the download history. Expanded targets (Spotify
  // songs) are matched by the files on disk instead.
  if (!options.redownload && options.history) {
    const plain = indexed.filter((entry) => typeof entry.item === "string");
    const { skipped, matches } = matchHistory(
      plain.map((entry) => entry.url),
      historyEntries,
      undefined,
      artifact.fingerprint,
    );
    const skippedSet = new Set(skipped);

    for (const entry of plain.filter((candidate) => skippedSet.has(candidate.url))) {
      const previous = matches.get(entry.url);
      addResult(entry, {
        url: entry.url,
        videoId: extractVideoId(entry.url),
        status: "skipped",
        reason: "history",
        mode: previous?.mode ?? modeOf(options),
        ...(previous?.title ? { title: previous.title } : {}),
        files: existingHistoryFiles(previous),
        outputDir: resolve(previous?.dir ?? options.outputDir),
      });
      if (!options.json) {
        console.error(warn(`Skipping (already downloaded): ${previous?.title ?? entry.url}  - use --redownload to force`));
      }
    }

    targets = indexed.filter((entry) => typeof entry.item !== "string" || !skippedSet.has(entry.url));
  }

  if (targets.length === 0) {
    return { failures: [], results: ordered(results), resultFor };
  }

  // History-only requests do not require tool discovery or installation.
  const { ytDlpCommand, ffmpegPath } = typeof tools === "function" ? await tools() : tools;

  // Build each command exactly once and reuse it for both printing and
  // running so the printed command always matches what executes.
  const tasks = buildTasks(targets.map((entry) => entry.item), options, { ffmpegPath })
    .map((task, position) => ({ ...task, entry: targets[position] }));

  if (options.printCommand) {
    for (const task of tasks) {
      console.log(formatCommand(ytDlpCommand, task.args));
    }
  }

  await mkdir(options.outputDir, { recursive: true });

  const jobs = Math.min(options.jobs, tasks.length);
  const queue = [...tasks];
  const failures = [];

  // TTY progress bars for one or many jobs. JSON and --print-command keep
  // streaming raw yt-dlp (or stay quiet) so agents and scripts stay stable.
  const useRenderer =
    process.stderr.isTTY &&
    !options.printCommand &&
    !options.json &&
    tasks.length <= MAX_PROGRESS_BARS;
  const renderer = useRenderer
    ? createProgressRenderer(tasks.map((task) => shortLabel(task.item)))
    : null;

  const base = (task, extra = {}) => ({
    url: task.url,
    videoId: extractVideoId(task.url),
    mode: modeOf(options),
    outputDir: resolve(options.outputDir),
    ...(task.item.source ? { source: task.item.source } : {}),
    ...extra,
  });

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      const lineHandler = renderer
        ? (line) => {
            const info = parseProgressLine(line);

            if (info) {
              renderer.update(task.index, info);
            } else if (tasks.length === 1 && line.trim() && !line.startsWith("[debug]")) {
              renderer.note(line);
            }
          }
        : undefined;
      const run = (args, matchFilter) => execute(ytDlpCommand, args, {
        onLine: lineHandler,
        quiet: options.json,
        ...(matchFilter ? { okCodes: [0, MAX_DOWNLOADS_REACHED] } : {}),
      });

      let subtitleWarning = null;

      try {
        let outcome;
        try {
          outcome = await run(task.args, task.item.matchFilter);
        } catch (error) {
          // Subtitles are extras: when they fail (often a rate limit), save
          // the media without them instead of failing the whole item.
          if (!task.noSubsArgs || !/subtitles/i.test(error.message)) throw error;
          subtitleWarning = `Subtitles could not be downloaded: ${lastLine(error.message)}`;
          if (!options.json) console.error(warn(`${shortLabel(task.item)}: ${subtitleWarning}`));
          outcome = await run(task.noSubsArgs, task.item.matchFilter);
        }

        // No search result had the expected length: take the top result.
        if (outcome.files.length === 0 && task.fallbackArgs && !outcome.sizeLimited) {
          outcome = await run(task.fallbackArgs, null);
        }

        if (outcome.files.length === 0) {
          renderer?.done(task.index, false);
          const guarded = Boolean(options.maxFilesize && outcome.sizeLimited);
          const error = new Error(
            guarded
              ? `No file downloaded; media exceeded --max-filesize ${options.maxFilesize}.`
              : "yt-dlp completed without reporting a final output file.",
          );
          error.exitCode = 1;
          failures.push({ url: task.url, error });
          addResult(task.entry, base(task, {
            status: guarded ? "skipped" : "failed",
            reason: guarded ? "max-filesize" : "no-output",
            files: [],
            error: errorDetails(error),
          }));
          continue;
        }

        renderer?.done(task.index, true);

        const meta = outcome.items?.[0] ?? null;
        const files = options.subs ? withSidecars(outcome.files) : outcome.files;

        if (ffmpegPath && (task.item.cover || task.item.spotifyTrackId)) {
          await addCover(task.item, outcome.files, ffmpegPath, { embed, lookupCover, json: options.json });
        }

        const result = base(task, {
          status: "downloaded",
          files,
          ...(subtitleWarning ? { warning: subtitleWarning } : {}),
          ...(meta?.title ? { title: meta.title } : {}),
          ...(meta?.extractor ? { extractor: meta.extractor } : {}),
          ...(meta?.webpageUrl ? { webpageUrl: meta.webpageUrl } : {}),
          ...(task.item.source && meta
            ? {
                match: {
                  id: meta.id,
                  title: meta.title,
                  url: meta.webpageUrl,
                  durationSeconds: meta.durationSeconds,
                },
              }
            : {}),
        });
        if (!result.videoId && meta?.extractor === "Youtube") result.videoId = meta.id;
        addResult(task.entry, result);

        if (!options.json) {
          for (const file of files) {
            console.log(`${ok("Saved:", process.stdout)} ${file}`);
          }
        }

        if (options.history) {
          recordDownload(
            {
              ts: new Date().toISOString(),
              id: result.videoId ?? null,
              url: task.url,
              mode: modeOf(options),
              dir: resolve(options.outputDir),
              files,
              ...(meta?.title ? { title: meta.title } : {}),
              ...(meta?.uploader ? { uploader: meta.uploader } : {}),
              ...(meta?.extractor ? { extractor: meta.extractor } : {}),
              ...(meta?.webpageUrl ? { webpageUrl: meta.webpageUrl } : {}),
            },
            undefined,
            { artifact: artifact.fingerprint },
          );
        }
      } catch (error) {
        renderer?.done(task.index, false);
        failures.push({ url: task.url, error });
        addResult(task.entry, base(task, {
          status: "failed",
          files: [],
          error: errorDetails(error),
        }));
      }
    }
  }

  await Promise.all(Array.from({ length: jobs }, () => worker()));
  renderer?.finish();

  return { failures, results: ordered(results), resultFor };
}

export function buildTasks(items, options, { ffmpegPath }, { capturePaths = true } = {}) {
  const argsFor = (url, item, overrides = {}) => {
    const args = buildYtDlpArgs(url, { ...itemOptions(item, options), ...overrides });
    if (capturePaths) {
      // --print implies quiet mode in yt-dlp. Keep size-limit diagnostics;
      // the process wrapper still keeps JSON stdout clean.
      args.splice(args.indexOf("--"), 0, "--no-quiet", ...outputCaptureArgs());
    }
    // Tell yt-dlp where ffmpeg lives when it is not on PATH.
    if (ffmpegPath && ffmpegPath !== "ffmpeg") {
      args.splice(args.indexOf("--"), 0, "--ffmpeg-location", ffmpegPath);
    }
    return args;
  };

  return items.map((item, index) => {
    const url = itemUrl(item);
    const fallbackUrl = typeof item === "object" ? item.fallbackUrl : null;
    return {
      url,
      index,
      item: typeof item === "object" ? item : { url },
      args: argsFor(url, item),
      fallbackArgs: fallbackUrl ? argsFor(fallbackUrl, item, { matchFilter: null }) : null,
      noSubsArgs: options.subs ? argsFor(url, item, { subs: false, embedSubs: false }) : null,
    };
  });
}

// Options for one item: expanded targets carry their own filename template,
// search filter, and tags. Items with their own cover art skip the video
// thumbnail.
function itemOptions(item, options) {
  if (typeof item !== "object" || item === null) return options;
  return {
    ...options,
    ...(item.template ? { template: item.template } : {}),
    matchFilter: item.matchFilter ?? null,
    metadata: item.metadata ?? null,
    ...(item.cover || item.spotifyTrackId ? { embedThumbnail: false } : {}),
  };
}

async function addCover(item, files, ffmpegPath, { embed, lookupCover, json }) {
  const file = files.find((candidate) => COVER_EXTENSIONS.has(extname(candidate).toLowerCase()));
  if (!file) return;

  try {
    const url = item.cover ?? (await lookupCover(item.spotifyTrackId));
    if (url) await embed(file, url, ffmpegPath);
  } catch (error) {
    if (!json) console.error(warn(`Could not add cover art to ${basename(file)}: ${error.message}`));
  }
}

// Subtitle files written next to the media ("Title [id].en.srt").
function withSidecars(files, list = readdirSync) {
  const all = [...files];

  for (const file of files) {
    const stem = basename(file, extname(file));
    let names = [];
    try {
      names = list(dirname(file));
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.startsWith(`${stem}.`) && /\.(srt|vtt|ass|lrc)$/i.test(name)) {
        const path = join(dirname(file), name);
        if (!all.includes(path)) all.push(path);
      }
    }
  }

  return all;
}

// --watch: poll the clipboard and download every new media link the user
// copies until Ctrl+C. Pure Node polling — no external watcher process.
// `expand` turns Spotify links into song targets.
export async function runWatchMode(initialUrls, options, tools, {
  expand = null,
  read = readClipboard,
  download = downloadUrls,
  intervalMs = WATCH_INTERVAL_MS,
} = {}) {
  const handled = new Set();
  let stopped = false;

  const stop = () => {
    stopped = true;
    process.stderr.write(`\n${muted("Stopped watching the clipboard.")}\n`);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  console.error(muted("Watching the clipboard for media links - press Ctrl+C to stop."));

  const processBatch = async (urls) => {
    const fresh = urls.filter((url) => {
      const key = urlKey(url);
      if (handled.has(key)) return false;
      handled.add(key);
      return true;
    });

    const accepted = [];
    for (const url of fresh) {
      const collection = options.playlist ? null : describeCollectionUrl(url);
      if (collection) {
        console.error(warn(`Skipping ${url}: it is ${collection}. Restart with --playlist to download every item.`));
      } else {
        accepted.push(url);
      }
    }

    if (accepted.length === 0) return;

    let items = accepted;
    if (expand && accepted.some(isSpotifyUrl)) {
      try {
        items = await expand(accepted);
      } catch (error) {
        console.error(err(`- ${error.message}`));
        items = accepted.filter((url) => !isSpotifyUrl(url));
      }
    }
    if (items.length === 0) return;

    const { failures } = await download(items, options, tools);

    if (stopped) {
      if (failures.length > 0) {
        console.error(muted("Interrupted. Partial downloads are kept; run again to resume them."));
      }
      return;
    }

    for (const { url, error } of failures) {
      console.error(err(`- ${url}: ${error.message}`));
    }
  };

  try {
    // Whatever is on the clipboard right now counts too — the user probably
    // copied it just before launching watch mode.
    await processBatch(dedupeUrlList([...initialUrls, ...extractMediaUrls(read())]));

    while (!stopped) {
      await sleep(intervalMs);

      if (stopped) {
        break;
      }

      await processBatch(extractMediaUrls(read()));
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

function lastLine(message) {
  const lines = String(message).split("\n").map((line) => line.trim()).filter(Boolean);
  return (lines.findLast((line) => /error/i.test(line)) ?? lines.at(-1) ?? "").replace(/^ERROR:\s*/, "");
}

function itemUrl(item) {
  return typeof item === "string" ? item : item.url;
}

function modeOf(options) {
  return options.video ? "video" : "audio";
}

function ordered(entries) {
  return entries.sort((a, b) => a.index - b.index).map((entry) => entry.result);
}

function shortLabel(item) {
  if (typeof item === "object" && item.label) return item.label;
  const url = itemUrl(item);
  return extractVideoId(url) ?? url;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
