// Embeds cover art (for example a Spotify album cover) into a saved MP3 or
// M4A with ffmpeg. Best effort: callers treat failures as warnings, never as
// a failed download.

import { spawn } from "node:child_process";
import { rm, rename, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import process from "node:process";
import { readBounded } from "./bootstrap.js";
import { VERSION } from "./version.js";

const MAX_COVER_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const FFMPEG_TIMEOUT_MS = 60_000;

export const COVER_EXTENSIONS = new Set([".mp3", ".m4a"]);

export function coverArgs(input, cover, output) {
  const ext = extname(input).toLowerCase();
  // Map only the audio from the original so an existing picture is replaced
  // rather than duplicated.
  const common = ["-y", "-loglevel", "error", "-i", input, "-i", cover, "-map", "0:a", "-map", "1:0", "-c", "copy"];

  if (ext === ".mp3") {
    return [
      ...common,
      "-id3v2_version", "3",
      "-metadata:s:v", "title=Album cover",
      "-metadata:s:v", "comment=Cover (front)",
      "-disposition:v", "attached_pic",
      output,
    ];
  }

  return [...common, "-disposition:v:0", "attached_pic", output];
}

export async function embedCover(file, imageUrl, ffmpegPath, {
  fetchImpl = globalThis.fetch,
  run = runFfmpeg,
} = {}) {
  const ext = extname(file).toLowerCase();
  if (!COVER_EXTENSIONS.has(ext)) return false;

  const response = await fetchImpl(imageUrl, {
    // Some image hosts reject requests without a client name.
    headers: { "user-agent": `lyt/${VERSION} (+https://github.com/TanaTTV/lyt)` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`cover download failed with HTTP ${response.status}`);
  const image = await readBounded(response, MAX_COVER_BYTES, "cover image");

  const stamp = `${process.pid}.${Date.now()}`;
  const coverFile = `${file}.${stamp}.cover.jpg`;
  const output = `${file}.${stamp}.tmp${ext}`;

  try {
    await writeFile(coverFile, image);
    await run(ffmpegPath, coverArgs(file, coverFile, output));
    await rename(output, file).catch(async (error) => {
      if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
      await rm(file, { force: true });
      await rename(output, file);
    });
    return true;
  } finally {
    await rm(coverFile, { force: true });
    await rm(output, { force: true });
  }
}

function runFfmpeg(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      if (stderr.length < 4000) stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
    });
  });
}
