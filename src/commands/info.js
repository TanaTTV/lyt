// `lyt info` / `lyt inspect` — media metadata without downloading.
// Public JSON contract: lyt.info.v1

import process from "node:process";
import { ensureYtDlp } from "../bootstrap.js";
import { usageError } from "../errors.js";
import { fetchInfo } from "../info.js";
import { errorDetails } from "../result.js";
import { VERSION } from "../version.js";

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

export async function runInfoCommand(argv) {
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
