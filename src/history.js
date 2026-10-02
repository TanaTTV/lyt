// Download history: one JSON object per line (JSONL) in the user data dir.
// Powers instant dedupe ("you already grabbed this variant") and the
// `lyt history` subcommand. Append-only, tiny, and trivially greppable.

import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { dataDir } from "./paths.js";
import { describeCollectionUrl, urlKey } from "./urls.js";

export function historyPath(dir = dataDir()) {
  return join(dir, "history.jsonl");
}

// Returns all history entries, oldest first. Corrupt lines are skipped so a
// damaged file never breaks downloads.
export function loadHistory(file = historyPath()) {
  if (!existsSync(file)) return [];

  const entries = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry === "object") entries.push(entry);
    } catch {
      // Skip corrupt lines.
    }
  }
  return entries;
}

export function recordDownload(
  entry,
  file = historyPath(),
  { artifact = process.env.LYT_ARTIFACT_FINGERPRINT } = {},
) {
  if (!isAbsolute(file)) {
    throw new Error(`History path must be absolute: ${file}`);
  }

  const value = artifact && !entry.artifact ? { ...entry, artifact } : entry;

  try {
    const directory = dirname(file);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32" && directory === dataDir()) {
      chmodSync(directory, 0o700);
    }
    appendFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    if (process.platform !== "win32") chmodSync(file, 0o600);
  } catch (error) {
    throw new Error(`Could not update history at ${file}: ${error.message}`, {
      cause: error,
    });
  }
}

export function clearHistory(file = historyPath()) {
  rmSync(file, { force: true });
}

// Build the artifact identity only after config, profile, clipboard, watch, and
// interactive options have been resolved. Computing this from raw argv would
// miss jobs whose URLs or final choices arrive later in the CLI flow.
export function buildArtifactFingerprint(options) {
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

export function existingHistoryFiles(entry, exists = existsSync) {
  if (!Array.isArray(entry?.files)) return [];
  return entry.files.filter((file) => typeof file === "string" && exists(file));
}

function entryIsActive(entry, exists) {
  return (
    !Array.isArray(entry.files) ||
    entry.files.length === 0 ||
    existingHistoryFiles(entry, exists).length > 0
  );
}

// Splits URLs into fresh and equivalent previously downloaded artifacts.
// The CLI passes its final artifact fingerprint explicitly so audio/video,
// quality, clip, profile, and output variants do not block one another. The
// environment fallback preserves compatibility with integrations using the
// earlier helper contract; no fingerprint retains legacy ID-only behavior.
export function splitByHistory(
  urls,
  entries,
  exists = existsSync,
  requestedArtifact = process.env.LYT_ARTIFACT_FINGERPRINT ?? null,
) {
  const { fresh, skipped } = matchHistory(urls, entries, exists, requestedArtifact);
  return { fresh, skipped };
}

// Like splitByHistory, plus `matches`: a Map from each skipped URL to the
// history entry that matched it. YouTube links match by video ID; links from
// every other site match by normalized URL (or the page URL yt-dlp reported).
// Collections such as playlists, channels, and sets are always fresh because
// they can gain new items.
export function matchHistory(
  urls,
  entries,
  exists = existsSync,
  requestedArtifact = process.env.LYT_ARTIFACT_FINGERPRINT ?? null,
) {
  const active = entries.filter((entry) => entryIsActive(entry, exists));
  const fresh = [];
  const skipped = [];
  const matches = new Map();

  for (const url of urls) {
    if (describeCollectionUrl(url)) {
      fresh.push(url);
      continue;
    }

    const key = urlKey(url);
    const matchedEntry = [...active].reverse().find((entry) => {
      if (!entryKeys(entry).includes(key)) return false;
      if (!requestedArtifact) return true;
      return entry.artifact === requestedArtifact;
    });

    if (matchedEntry) {
      // Promote the exact match so callers that look up the newest entry for
      // this source report the right mode, files, and output directory when
      // several variants exist.
      promoteEntry(entries, matchedEntry);
      matches.set(url, matchedEntry);
      skipped.push(url);
    } else {
      fresh.push(url);
    }
  }

  return { fresh, skipped, matches };
}

function entryKeys(entry) {
  const keys = [];
  if (typeof entry.id === "string" && entry.id) keys.push(`youtube:${entry.id}`);
  if (typeof entry.url === "string" && entry.url) keys.push(urlKey(entry.url));
  if (typeof entry.webpageUrl === "string" && entry.webpageUrl) keys.push(urlKey(entry.webpageUrl));
  return keys;
}

function promoteEntry(entries, entry) {
  const index = entries.indexOf(entry);
  if (index < 0 || index === entries.length - 1) return;
  entries.splice(index, 1);
  entries.push(entry);
}

// Case-insensitive substring search across user-meaningful entry fields.
export function searchHistory(entries, query) {
  const needle = String(query ?? "").toLowerCase();
  if (!needle) return entries;

  const fields = [
    "id",
    "url",
    "mode",
    "artifact",
    "title",
    "uploader",
    "extractor",
    "webpageUrl",
    "description",
    "dir",
    "files",
    "ts",
  ];

  return entries.filter((entry) =>
    fields
      .map((field) => entry[field])
      .filter((value) => value != null)
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}
