// `lyt info` / `lyt inspect` — media metadata without downloading.
// Public JSON contract: lyt.info.v1

import process from "node:process";
import { ensureYtDlp } from "../bootstrap.js";
import { usageError } from "../errors.js";
import { fetchInfo } from "../info.js";
import { errorDetails } from "../result.js";
import { VERSION } from "../version.js";

import { parseInfoArgs } from "../commandArgs.js";
export { parseInfoArgs } from "../commandArgs.js";

export async function runInfoCommand(argv, {
  ensureTool = ensureYtDlp,
  inspect = fetchInfo,
  log = console.log,
  logError = console.error,
} = {}) {
  const { json, noDownload, jobs, urls } = parseInfoArgs(argv);

  if (urls.length === 0) {
    throw usageError("Usage: lyt info <url> [more-urls...] [--jobs 1-16] [--json]");
  }

  const command = await ensureTool({
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
      else logError(`- ${result.url}: ${result.error.message}`);
    }
  }
  async function worker() {
    while (next < urls.length) {
      const index = next++;
      const url = urls[index];
      try {
        const media = await inspect(url, { command });
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

function printInfo(url, media, log = console.log) {
  log(media.title || url);

  const summary = [];
  if (media.uploader) summary.push(media.uploader);
  if (media.durationSeconds != null) summary.push(formatDuration(media.durationSeconds));
  if (media.extractor) summary.push(media.extractor);
  if (media.isLive) summary.push("LIVE");
  if (summary.length > 0) log(`  ${summary.join("  -  ")}`);

  if (media.heights.length > 0) {
    log(`  video: ${media.heights.map((height) => `${height}p`).join(", ")}`);
  }
  if (media.audioBitrates.length > 0) {
    log(`  audio: ${media.audioBitrates.map((rate) => `${rate}k`).join(", ")}`);
  }
  if (media.heights.length === 0 && media.audioBitrates.length === 0) {
    log("  no downloadable formats reported");
  }
  if (media.webpageUrl) log(`  url: ${media.webpageUrl}`);

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
