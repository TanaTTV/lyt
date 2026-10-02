import { spawn } from "node:child_process";
import { runJsonTool } from "./jsonProcess.js";
import { ytDlpJsRuntimeArgs } from "./jsRuntime.js";

// Shapes a `yt-dlp -J` (JSON dump) payload into the stable lyt.info.v1 media
// description agents can read before committing to a download. Pure, so it is
// unit-tested with sample payloads.
export function parseInfo(jsonText) {
  const info = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    throw new Error("Tool output did not contain media metadata.");
  }
  // A playlist dump nests entries; describe the first real item.
  const media = Array.isArray(info.entries)
    ? info.entries.find(Boolean) ?? info
    : info;

  const rawFormats = Array.isArray(media.formats) ? media.formats : [];
  const heights = new Set();
  const audioBitrates = new Set();
  const formats = [];

  for (const format of rawFormats) {
    const hasVideo = format.vcodec && format.vcodec !== "none";
    const hasAudio = format.acodec && format.acodec !== "none";

    if (hasVideo && Number.isFinite(format.height)) {
      heights.add(format.height);
    }

    if (hasAudio && !hasVideo && Number.isFinite(format.abr) && format.abr > 0) {
      audioBitrates.add(Math.round(format.abr));
    }

    formats.push({
      formatId: stringOrNull(format.format_id),
      ext: stringOrNull(format.ext),
      height: Number.isFinite(format.height) ? format.height : null,
      fps: Number.isFinite(format.fps) ? format.fps : null,
      vcodec: hasVideo ? String(format.vcodec) : null,
      acodec: hasAudio ? String(format.acodec) : null,
      abr: Number.isFinite(format.abr) ? Math.round(format.abr) : null,
      filesize: intOrNull(format.filesize ?? format.filesize_approx),
      note: stringOrNull(format.format_note),
    });
  }

  return {
    id: stringOrNull(media.id),
    extractor: stringOrNull(media.extractor_key ?? media.extractor),
    title: typeof media.title === "string" ? media.title : "",
    uploader: stringOrNull(media.uploader ?? media.channel ?? media.uploader_id),
    durationSeconds: Number.isFinite(media.duration) ? media.duration : null,
    isLive: isLive(media),
    thumbnail: stringOrNull(media.thumbnail),
    webpageUrl: stringOrNull(media.webpage_url),
    heights: [...heights].sort((a, b) => b - a),
    audioBitrates: [...audioBitrates].sort((a, b) => b - a),
    formats,
  };
}

// Runs `yt-dlp -J` for a URL and returns the shaped media description without
// downloading media. The spawn is injectable so callers can test the wiring
// without a real yt-dlp.
export async function fetchInfo(
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
    return parseInfo(payload);
  } catch (cause) {
    const error = new Error(`yt-dlp could not read media info for ${url}\n${cause.message}`, { cause });
    error.exitCode = cause.exitCode ?? 1;
    if (cause.code) error.code = cause.code;
    throw error;
  }
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function intOrNull(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function isLive(media) {
  if (typeof media.is_live === "boolean") return media.is_live;
  return media.live_status === "is_live";
}
