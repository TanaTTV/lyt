import { spawn } from "node:child_process";
import { runJsonTool } from "./jsonProcess.js";
import { ytDlpJsRuntimeArgs } from "./jsRuntime.js";
import { labelHeight } from "./quality.js";
import { formatCommand } from "./ytDlp.js";

// Parses `yt-dlp -J` (JSON dump) output into the set of qualities actually
// available for a URL. Pure, so it is unit-tested with sample payloads.
export function parseFormats(jsonText) {
  const info = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    throw new Error("Tool output did not contain media metadata.");
  }
  // A playlist dump nests entries; fall back to the first real video.
  const video = Array.isArray(info.entries) ? info.entries.find(Boolean) ?? info : info;

  const formats = Array.isArray(video.formats) ? video.formats : [];
  const heights = new Set();
  const audioBitrates = new Set();

  for (const format of formats) {
    const hasVideo = format.vcodec && format.vcodec !== "none";
    const hasAudio = format.acodec && format.acodec !== "none";

    if (hasVideo && Number.isFinite(format.height)) {
      heights.add(format.height);
    }

    // Audio-only streams tell us the available audio bitrates.
    if (hasAudio && !hasVideo && Number.isFinite(format.abr) && format.abr > 0) {
      audioBitrates.add(Math.round(format.abr));
    }
  }

  return {
    title: typeof video.title === "string" ? video.title : "",
    heights: [...heights].sort((a, b) => b - a),
    audioBitrates: [...audioBitrates].sort((a, b) => b - a),
  };
}

// Runs `yt-dlp -J` for a URL and returns the parsed quality set. The spawn is
// injectable so callers can test the wiring without a real yt-dlp.
export async function listFormats(
  url,
  {
    command = "yt-dlp",
    spawnFn = spawn,
    runtimeArgs = ytDlpJsRuntimeArgs(),
    ...toolOptions
  } = {},
) {
  try {
    const payload = await runJsonTool(command, [
      "-J", "--no-warnings", ...runtimeArgs, "--no-playlist", "--", url,
    ], { spawnFn, ...toolOptions });
    return parseFormats(payload);
  } catch (cause) {
    const error = new Error(`yt-dlp could not read formats for ${url}\n${cause.message}`, { cause });
    error.exitCode = cause.exitCode ?? 1;
    if (cause.code) error.code = cause.code;
    throw error;
  }
}

export function printFormats(url, formats) {
  console.log(formats.title ? `${formats.title}` : url);

  if (formats.heights.length > 0) {
    const labels = formats.heights.map((height) => labelHeight(height));
    console.log(`  video: ${labels.join(", ")}`);
    const best = formats.heights[0];
    console.log(`  download best with: ${formatCommand("lyt", ["--video", "-q", `${best}p`, "--", url])}`);
  }

  if (formats.audioBitrates.length > 0) {
    console.log(`  audio: ${formats.audioBitrates.map((rate) => `${rate}k`).join(", ")}`);
  }

  if (formats.heights.length === 0 && formats.audioBitrates.length === 0) {
    console.log("  no downloadable formats reported");
  }

  console.log("");
}
