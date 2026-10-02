// Download coordinator. Subcommands are routed in entry.js; this module only
// runs parse → config → clipboard → interactive / list / dry-run / download.

import { readFileSync } from "node:fs";
import process from "node:process";
import { resolve } from "node:path";
import {
  formatCommand,
  normalizeOptions,
  parseArgs,
  usage,
} from "./ytDlp.js";
import { promptForJob } from "./interactive.js";
import { listFormats, printFormats } from "./formats.js";
import { ensureYtDlp } from "./bootstrap.js";
import {
  mergeClipboardUrls,
  readClipboard,
  shouldReadClipboardForUrls,
} from "./clipboard.js";
import { configToOptions, loadConfig, resolveProfile } from "./config.js";
import {
  buildTasks,
  downloadUrls,
  prepareTools,
  runWatchMode,
} from "./download.js";
import { handleCliError, usageError } from "./errors.js";
import { errorDetails, resultEnvelope } from "./result.js";
import {
  expandSpotifyUrls,
  isSpotifyUrl,
  spotifyCredentials,
  writePlaylistFile,
} from "./spotify.js";
import { dedupeUrlList, describeCollectionUrl } from "./urls.js";
import { VERSION } from "./version.js";
import { runMetaCommand } from "./commands/meta.js";
import {
  checkForUpdate,
  isUpdateCheckEnabled,
  maybeNotifyUpdate,
} from "./updateCheck.js";
import { err, muted, ok, warn } from "./ui.js";

// Re-export helpers tests and external callers may import from cli.js.
export {
  mergeClipboardUrls,
  shouldReadClipboardForUrls,
} from "./clipboard.js";
export { runCommand } from "./process.js";

// Parallel song downloads for Spotify links when no job count was chosen.
const SPOTIFY_DEFAULT_JOBS = 3;

export function run(argv, defaults = {}) {
  return main(argv, defaults).catch((error) => {
    handleCliError(error, { json: argv.includes("--json") });
  });
}

export async function main(argv, defaults = {}) {
  const parsed = parseArgs(argv);

  // Option precedence (lowest to highest): persistent config file,
  // entry-point defaults (yt3 -> audio, yt4 -> video), --profile bundle,
  // explicit flags. The aliases pick the mode even when config sets one.
  const userConfig = loadConfig();
  const updateCheckEnabled = isUpdateCheckEnabled(userConfig);

  if (parsed.help) return runMetaCommand("--help", userConfig);
  if (parsed.version) return runMetaCommand("--version", userConfig);

  const profileName = parsed.options.profile ?? userConfig.profile ?? null;
  const profileOptions = profileName ? resolveProfile(profileName) : {};
  const jobsChosen = parsed.options.jobs !== undefined || userConfig.jobs !== undefined;
  parsed.options = {
    ...configToOptions(userConfig),
    ...defaults,
    ...profileOptions,
    ...parsed.options,
  };

  if (parsed.options.batchFiles) {
    parsed.urls = dedupeUrlList([...parsed.urls, ...readBatchFiles(parsed.options.batchFiles)]);
  }

  // Explicit --paste always reads the clipboard. With no URL on an interactive
  // TTY, also auto-read so "copy link → lyt" works without flags. Scripts,
  // --json, and non-TTY runs stay explicit (no silent clipboard access).
  if (
    shouldReadClipboardForUrls({
      urls: parsed.urls,
      paste: parsed.options.paste,
      watch: parsed.options.watch,
      json: parsed.options.json,
      isTTY: Boolean(process.stdin.isTTY),
    })
  ) {
    const { urls, fromClipboard } = mergeClipboardUrls({
      urls: parsed.urls,
      clipboardText: readClipboard(),
      paste: parsed.options.paste,
      watch: parsed.options.watch,
    });
    parsed.urls = urls;

    if (fromClipboard.length > 0) {
      console.error(ok(`Picked up ${fromClipboard.length} URL(s) from the clipboard.`));
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

  // Spotify links become per-song YouTube searches. They are songs, so default
  // to MP3 unless config, a profile, or a flag already chose a format, and
  // fetch a few songs at once unless a job count was chosen.
  const hasSpotify = parsed.urls.some(isSpotifyUrl);
  if (hasSpotify && parsed.options.mp3 === undefined && !parsed.options.video) {
    parsed.options.mp3 = true;
  }
  if (hasSpotify && !jobsChosen && parsed.options.jobs === undefined) {
    parsed.options.jobs = SPOTIFY_DEFAULT_JOBS;
  }

  const options = normalizeOptions(parsed.options);
  const urls = parsed.urls;

  // yt-dlp's --no-playlist does not stop links that are only a playlist,
  // channel, or set, so enforce the playlist opt-in here.
  if (!options.playlist) {
    const collections = urls
      .map((url) => ({ url, kind: describeCollectionUrl(url) }))
      .filter((entry) => entry.kind);
    if (collections.length > 0) {
      const lines = collections.map((entry) => `- ${entry.url} is ${entry.kind}`);
      throw usageError(
        `Refusing to download every item without --playlist:\n${lines.join("\n")}\n` +
          "Add --playlist to download them all, or pass a single video link.",
      );
    }
  }

  const credentials = spotifyCredentials(userConfig);
  const expandSpotify = (list) => expandSpotifyUrls(list, options, { credentials });
  let items = urls;
  let existing = [];
  let collections = [];
  let warnings = [];

  if (hasSpotify && !options.watch) {
    const expanded = await expandSpotify(urls);
    items = expanded.items;
    collections = expanded.collections;
    warnings = expanded.warnings;
    // Songs already on disk, reported alongside download results.
    existing = expanded.skipped.map((song) => ({
      url: song.url,
      videoId: null,
      status: "skipped",
      reason: "exists",
      mode: options.video ? "video" : "audio",
      title: song.label,
      files: [resolve(song.file)],
      outputDir: resolve(options.outputDir),
      source: song.source,
    }));

    if (items.length === 0) {
      if (!options.dryRun) writePlaylists(collections, (target) => skippedFile(existing, target), options);
      if (options.json) {
        console.log(JSON.stringify(resultEnvelope({
          command: options.dryRun ? "dry-run" : "download",
          ok: true,
          results: existing,
          warnings,
          version: VERSION,
        })));
      } else {
        console.error(ok("Every song is already downloaded."));
      }
      return;
    }
  }

  if (items.length === 0 && !options.watch) {
    const error = new Error(`${usage()}\n\nMissing URL.`);
    error.exitCode = 2;
    throw error;
  }

  if (options.listFormats) {
    const command = await ensureYtDlp({ noDownload });
    const results = [];

    for (const url of items.map((item) => (typeof item === "string" ? item : item.url))) {
      try {
        const formats = await listFormats(url, { command });
        results.push({ url, status: "available", ...formats });
        if (!options.json) printFormats(url, formats);
      } catch (error) {
        results.push({ url, status: "failed", error: errorDetails(error) });
        if (!options.json) console.error(err(`- ${url}: ${error.message}`));
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
    const tasks = buildTasks(items, options, tools, { capturePaths: false });

    if (options.json) {
      console.log(JSON.stringify(resultEnvelope({
        command: "dry-run",
        ok: true,
        results: [
          ...existing,
          ...tasks.map((task) => ({
            url: task.url,
            status: "planned",
            command: formatCommand(tools.ytDlpCommand, task.args),
            executable: tools.ytDlpCommand,
            args: task.args,
            outputDir: resolve(options.outputDir),
            ...(task.item.source ? { source: task.item.source } : {}),
          })),
        ],
        warnings,
        version: VERSION,
      })));
    } else {
      for (const task of tasks) {
        console.log(formatCommand(tools.ytDlpCommand, task.args));
      }
    }

    return;
  }

  if (options.watch) {
    if (options.json) {
      throw usageError("--json cannot be combined with --watch; use bounded URL batches.");
    }
    const tools = await prepareTools(options, noDownload);
    return runWatchMode(urls, options, tools, {
      // Copied Spotify links become songs. Tags and cover art need ffmpeg;
      // without it the songs are still saved, just untagged.
      expand: async (list) => (await expandSpotify(list)).items.map((item) =>
        typeof item === "object" && !tools.ffmpegPath
          ? { ...item, metadata: null, cover: null, spotifyTrackId: null }
          : item),
    });
  }

  // Refresh notices alongside useful work rather than after a download finishes.
  const updatePromise = !options.json && updateCheckEnabled
    ? checkForUpdate().catch(() => null)
    : null;

  const { failures, results, resultFor } = await downloadUrls(
    items,
    options,
    () => prepareTools(options, noDownload, items),
  );

  if (collections.length > 0) {
    writePlaylists(collections, (target) => {
      const result = resultFor.get(target);
      if (result?.status === "downloaded") return result.files[0];
      return skippedFile(existing, target);
    }, options);
  }

  const allResults = [...existing, ...results];

  if (options.json) {
    console.log(JSON.stringify(resultEnvelope({
      command: "download",
      ok: failures.length === 0,
      results: allResults,
      warnings,
      version: VERSION,
    })));
  } else if (allResults.length > 1) {
    console.error(summaryLine(allResults));
  }

  if (failures.length > 0) {
    const lines = failures.map(({ url, error }) => `- ${url}: ${error.message}`);
    const error = new Error(`Download failed:\n${lines.join("\n")}`);
    error.exitCode = 1;
    error.jsonPrinted = options.json;
    throw error;
  }

  // Human runs only: quiet npm registry check so people notice new releases.
  if (!options.json && updateCheckEnabled) {
    await maybeNotifyUpdate({ enabled: true, check: () => updatePromise });
  }
}

// URLs from -a/--batch-file: one per line; blank lines and "#" comments are
// ignored. "-" reads standard input.
export function readBatchFiles(paths, { read = readFileSync } = {}) {
  const urls = [];

  for (const path of paths) {
    let text;
    try {
      text = path === "-" ? read(0, "utf8") : read(path, "utf8");
    } catch (error) {
      throw usageError(`Could not read batch file ${path}: ${error.message}`);
    }

    for (const line of String(text).split(/\r?\n/)) {
      const value = line.trim();
      if (value && !value.startsWith("#")) urls.push(value);
    }
  }

  return urls;
}

// "Done: 12 saved · 3 skipped · 1 failed" for runs with several items.
export function summaryLine(results) {
  const count = (status) => results.filter((result) => result.status === status).length;
  const parts = [
    `${count("downloaded")} saved`,
    count("skipped") > 0 ? `${count("skipped")} skipped` : null,
    count("failed") > 0 ? `${count("failed")} failed` : null,
  ].filter(Boolean);
  const line = `Done: ${parts.join(" · ")}`;
  return count("failed") > 0 ? warn(line) : ok(line);
}

// The file of a Spotify song that was skipped because it was already saved.
function skippedFile(existing, target) {
  return existing.find((song) => song.source === target.source)?.files[0] ?? null;
}

function writePlaylists(collections, fileFor, options) {
  for (const collection of collections) {
    try {
      const path = writePlaylistFile(collection, fileFor);
      if (path && !options.json) console.error(muted(`Playlist file: ${path}`));
    } catch (error) {
      if (!options.json) console.error(warn(`Could not write the playlist file: ${error.message}`));
    }
  }
}
