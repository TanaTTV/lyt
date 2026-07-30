import { spawn } from "node:child_process";
import { ytDlpJsRuntimeArgs } from "./jsRuntime.js";

// Shapes a `yt-dlp -J` (JSON dump) payload into the stable lyt.info.v1 media
// description agents can read before committing to a download. Pure, so it is
// unit-tested with sample payloads.
export function parseInfo(jsonText) {
  const info = JSON.parse(jsonText);
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
export function fetchInfo(
  url,
  {
    command = "yt-dlp",
    spawnFn = spawn,
    runtimeArgs = ytDlpJsRuntimeArgs(),
  } = {},
) {
  return new Promise((resolve, reject) => {
    const args = [
      "-J",
      "--no-warnings",
      ...runtimeArgs,
      "--no-playlist",
      "--",
      url,
    ];
    const child = spawnFn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        const error = new Error(
          `yt-dlp could not read media info for ${url}` +
            (stderr.trim() ? `\n${stderr.trim()}` : ""),
        );
        error.exitCode = code ?? 1;
        reject(error);
        return;
      }

      try {
        resolve(parseInfo(stdout));
      } catch {
        reject(new Error(`Could not parse yt-dlp output for ${url}.`));
      }
    });
  });
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
