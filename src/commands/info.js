// `lyt info` / `lyt inspect` — media metadata without downloading.
// Public JSON contract: lyt.info.v1

import process from "node:process";
import { ensureYtDlp } from "../bootstrap.js";
import { usageError } from "../errors.js";
import { loadConfig } from "../config.js";
import { fetchInfo } from "../info.js";
import {
  fetchSpotifyTracks,
  isSpotifyUrl,
  parseSpotifyUrl,
  spotifyCredentials,
} from "../spotify.js";
import { errorDetails } from "../result.js";
import { err, heading, muted } from "../ui.js";
import { VERSION } from "../version.js";

import { parseInfoArgs } from "../commandArgs.js";
export { parseInfoArgs } from "../commandArgs.js";

export async function runInfoCommand(argv, {
  ensureTool = ensureYtDlp,
  inspect = fetchInfo,
  readSpotify = fetchSpotifyTracks,
  log = console.log,
  logError = console.error,
} = {}) {
  const { json, noDownload, jobs, urls } = parseInfoArgs(argv);

  if (urls.length === 0) {
    throw usageError("Usage: lyt info <url> [more-urls...] [--jobs 1-16] [--json]");
  }

  const credentials = urls.some(isSpotifyUrl) ? spotifyCredentials(loadConfig()) : null;
  // Spotify links are read from Spotify itself and need no yt-dlp.
  const command = urls.every(isSpotifyUrl)
    ? null
    : await ensureTool({
        noDownload: noDownload || process.env.LYT_NO_DOWNLOAD === "1",
      });
  const results = new Array(urls.length);
  let next = 0;
  let nextToPrint = 0;
  function printReadyResults() {
    // Human output can stream as soon as earlier input items are complete.
    while (!json && nextToPrint < results.length && results[nextToPrint]) {
      const result = results[nextToPrint++];
      if (result.status === "available") printInfo(result.url, result, log);
      else logError(err(`- ${result.url}: ${result.error.message}`));
    }
  }
  async function worker() {
    while (next < urls.length) {
      const index = next++;
      const url = urls[index];
      try {
        const media = isSpotifyUrl(url)
          ? spotifyInfo(url, await readSpotify(url, { credentials }))
          : await inspect(url, { command });
        results[index] = { url, status: "available", ...media };
      } catch (error) {
        results[index] = { url, status: "failed", error: errorDetails(error) };
      }
      printReadyResults();
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, urls.length) }, worker));

  if (json) {
    log(JSON.stringify({
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

// lyt.info.v1 description of a Spotify collection. `spotify.tracks` lists the
// songs lyt would search for on YouTube.
export function spotifyInfo(url, collection) {
  const tracks = collection.tracks.map((track, index) => ({
    position: index + 1,
    artist: track.artist || null,
    title: track.title,
    durationSeconds: track.durationMs ? Math.round(track.durationMs / 1000) : null,
  }));
  const known = tracks.every((track) => track.durationSeconds != null);

  return {
    id: parseSpotifyUrl(url)?.id ?? null,
    extractor: "Spotify",
    title: collection.name,
    uploader: collection.type === "track" ? tracks[0]?.artist ?? null : null,
    durationSeconds: known ? tracks.reduce((total, track) => total + track.durationSeconds, 0) : null,
    isLive: false,
    thumbnail: collection.coverUrl ?? null,
    webpageUrl: url,
    heights: [],
    audioBitrates: [],
    formats: [],
    spotify: { type: collection.type, truncated: collection.truncated, tracks },
  };
}

function printInfo(url, media, log = console.log) {
  const stream = process.stdout;
  log(heading(media.title || url, stream));

  if (media.spotify) {
    const { type, tracks, truncated } = media.spotify;
    log(`  ${muted(`Spotify ${type} - ${tracks.length} song(s)${truncated ? " (first 100 shown publicly)" : ""}`, stream)}`);
    for (const track of tracks) {
      const length = track.durationSeconds != null ? `  ${muted(formatDuration(track.durationSeconds), stream)}` : "";
      log(`  ${String(track.position).padStart(3)}. ${track.artist ? `${track.artist} - ` : ""}${track.title}${length}`);
    }
    log("");
    return;
  }

  const summary = [];
  if (media.uploader) summary.push(media.uploader);
  if (media.durationSeconds != null) summary.push(formatDuration(media.durationSeconds));
  if (media.extractor) summary.push(media.extractor);
  if (media.isLive) summary.push("LIVE");
  if (summary.length > 0) log(`  ${muted(summary.join("  -  "), stream)}`);

  if (media.heights.length > 0) {
    log(`  ${muted("video:", stream)} ${media.heights.map((height) => `${height}p`).join(", ")}`);
  }
  if (media.audioBitrates.length > 0) {
    log(`  ${muted("audio:", stream)} ${media.audioBitrates.map((rate) => `${rate}k`).join(", ")}`);
  }
  if (media.heights.length === 0 && media.audioBitrates.length === 0) {
    log(`  ${muted("no downloadable formats reported", stream)}`);
  }
  if (media.webpageUrl) log(`  ${muted("url:", stream)} ${media.webpageUrl}`);

  log("");
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
