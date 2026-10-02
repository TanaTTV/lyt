import process from "node:process";
import { fetchMediaJson, parseInfo } from "./info.js";
import { labelHeight } from "./quality.js";
import { heading, muted } from "./ui.js";
import { formatCommand } from "./ytDlp.js";

// The qualities actually available for a URL: the title plus the video
// heights and audio bitrates from a `yt-dlp -J` payload. Pure, so it is
// unit-tested with sample payloads.
export function parseFormats(jsonText) {
  const { title, heights, audioBitrates } = parseInfo(jsonText);
  return { title, heights, audioBitrates };
}

// Runs `yt-dlp -J` for a URL and returns the parsed quality set. The spawn is
// injectable so callers can test the wiring without a real yt-dlp.
export async function listFormats(url, options = {}) {
  return parseFormats(await fetchMediaJson(url, options, "formats"));
}

export function printFormats(url, formats) {
  const stream = process.stdout;
  console.log(heading(formats.title ? `${formats.title}` : url, stream));

  if (formats.heights.length > 0) {
    const labels = formats.heights.map((height) => labelHeight(height));
    console.log(`  ${muted("video:", stream)} ${labels.join(", ")}`);
    const best = formats.heights[0];
    console.log(`  ${muted("download best with:", stream)} ${formatCommand("lyt", ["--video", "-q", `${best}p`, "--", url])}`);
  }

  if (formats.audioBitrates.length > 0) {
    console.log(`  ${muted("audio:", stream)} ${formats.audioBitrates.map((rate) => `${rate}k`).join(", ")}`);
  }

  if (formats.heights.length === 0 && formats.audioBitrates.length === 0) {
    console.log(`  ${muted("no downloadable formats reported", stream)}`);
  }

  console.log("");
}
