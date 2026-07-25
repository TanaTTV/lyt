import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { VERSION } from "./version.js";

const MAX_SEARCH_RESULTS = 50;
const DEFAULT_OUTPUT_TEMPLATE = "%(title).180B [%(id)s].%(ext)s";

export async function inspectMedia(
  url,
  {
    command = "yt-dlp",
    spawnFn = spawn,
    version = VERSION,
  } = {},
) {
  const requestedUrl = requireText(url, "URL");
  const raw = await runYtDlpJson(
    command,
    [
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      "--no-playlist",
      "--",
      requestedUrl,
    ],
    { spawnFn, operation: `inspect ${requestedUrl}` },
  );

  return parseInspectPayload(raw, { requestedUrl, version });
}

export function parseInspectPayload(payload, { requestedUrl = "", version = VERSION } = {}) {
  const raw = parseJsonPayload(payload);
  const media = Array.isArray(raw.entries)
    ? raw.entries.find((entry) => entry && typeof entry === "object") ?? raw
    : raw;

  const formats = Array.isArray(media.formats)
    ? media.formats.map(normalizeFormat)
    : [];

  return {
    schema: "lyt.inspect.v1",
    version,
    command: "inspect",
    ok: true,
    requestedUrl: String(requestedUrl || media.webpage_url || media.original_url || ""),
    media: {
      id: textOrNull(media.id),
      title: textOrNull(media.title),
      webpageUrl: canonicalMediaUrl(media),
      durationSeconds: finiteOrNull(media.duration),
      viewCount: finiteOrNull(media.view_count),
      uploader: textOrNull(media.uploader),
      channel: textOrNull(media.channel),
      thumbnail: textOrNull(media.thumbnail),
      availability: textOrNull(media.availability),
      liveStatus: textOrNull(media.live_status),
    },
    formats,
    captions: {
      manual: normalizeCaptionLanguages(media.subtitles),
      automatic: normalizeCaptionLanguages(media.automatic_captions),
    },
  };
}

export async function searchMedia(
  query,
  {
    limit = 10,
    command = "yt-dlp",
    spawnFn = spawn,
    version = VERSION,
  } = {},
) {
  const normalizedQuery = requireText(query, "search query");
  const normalizedLimit = normalizeSearchLimit(limit);
  const target = `ytsearch${normalizedLimit}:${normalizedQuery}`;
  const raw = await runYtDlpJson(
    command,
    [
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--skip-download",
      "--",
      target,
    ],
    { spawnFn, operation: `search for "${normalizedQuery}"` },
  );

  return parseSearchPayload(raw, {
    query: normalizedQuery,
    limit: normalizedLimit,
    version,
  });
}

export function parseSearchPayload(
  payload,
  { query = "", limit = 10, version = VERSION } = {},
) {
  const raw = parseJsonPayload(payload);
  const entries = Array.isArray(raw.entries) ? raw.entries.filter(Boolean) : [];
  const normalizedLimit = normalizeSearchLimit(limit);
  const results = entries.slice(0, normalizedLimit).map((entry) => ({
    id: textOrNull(entry.id),
    title: textOrNull(entry.title),
    url: canonicalMediaUrl(entry),
    durationSeconds: finiteOrNull(entry.duration),
    viewCount: finiteOrNull(entry.view_count),
    uploader: textOrNull(entry.uploader),
    channel: textOrNull(entry.channel),
    thumbnail: textOrNull(entry.thumbnail),
    availability: textOrNull(entry.availability),
    liveStatus: textOrNull(entry.live_status),
  }));

  return {
    schema: "lyt.search.v1",
    version,
    command: "search",
    ok: true,
    query: String(query),
    limit: normalizedLimit,
    total: results.length,
    results,
  };
}

export async function planMedia(
  url,
  {
    inspectFn = inspectMedia,
    inspectOptions = {},
    options = {},
    historyMatch = null,
    tools = {},
    version = VERSION,
  } = {},
) {
  const inspection = await inspectFn(url, { ...inspectOptions, version });
  return buildMediaPlan(inspection, {
    options,
    historyMatch,
    tools,
    version,
  });
}

export function buildMediaPlan(
  inspection,
  {
    options = {},
    historyMatch = null,
    tools = {},
    version = inspection?.version ?? VERSION,
  } = {},
) {
  if (inspection?.schema !== "lyt.inspect.v1" || !inspection.media) {
    throw usageError("plan requires a lyt.inspect.v1 inspection document");
  }

  const selected = selectPlannedFormats(inspection.formats, options);
  const ffmpegRequired = requiresFfmpeg(options);
  const history = normalizeHistoryMatch(historyMatch);
  const requirements = [
    toolRequirement("yt-dlp", true, tools.ytDlp, "read metadata and download media"),
    toolRequirement(
      "ffmpeg",
      ffmpegRequired,
      tools.ffmpeg,
      "convert, merge, clip, split, normalize, or embed media",
    ),
  ];
  const unavailable = requirements.some(
    (requirement) => requirement.required && requirement.available === false,
  );
  const redownload = options.redownload === true;

  return {
    schema: "lyt.plan.v1",
    version,
    command: "plan",
    ok: !unavailable,
    requestedUrl: inspection.requestedUrl,
    media: inspection.media,
    selection: selected.selection,
    estimate: selected.estimate,
    output: {
      directory: resolve(options.outputDir ?? "downloads"),
      template: String(options.template ?? DEFAULT_OUTPUT_TEMPLATE),
      predictedPath: options.outputPath ? resolve(options.outputPath) : null,
    },
    requirements,
    history,
    sideEffects: {
      performedByPlan: {
        networkMetadataRead: true,
        mediaDownloaded: false,
        filesWritten: false,
        toolsInstalled: false,
      },
      ifApproved: {
        networkMediaDownload: true,
        filesWritten: true,
        mayOverwriteFiles: options.forceOverwrite === true,
        mayInstallMissingTools: options.noDownload !== true,
      },
    },
    recommendation: unavailable
      ? "blocked"
      : history.matched && !redownload
        ? "skip"
        : "approve",
  };
}

export function selectPlannedFormats(formats = [], options = {}) {
  const normalized = Array.isArray(formats) ? formats : [];
  const videoMode = options.video === true;
  const candidates = normalized.filter((format) =>
    videoMode ? format.hasVideo : format.hasAudio,
  );
  let selected = [];
  let strategy;

  if (videoMode) {
    const cap = finiteOrNull(options.maxHeight);
    const eligible = candidates.filter((format) =>
      cap == null || format.height == null || format.height <= cap,
    );
    const video = [...eligible].sort(compareVideo)[0] ?? null;
    if (video) selected.push(video);

    if (video && !video.hasAudio) {
      const audio = normalized
        .filter((format) => format.hasAudio && !format.hasVideo)
        .sort(compareAudio)[0];
      if (audio) selected.push(audio);
    }
    strategy = cap == null ? "best playable video" : `best playable video up to ${cap}p`;
  } else {
    const audioOnly = candidates.filter((format) => !format.hasVideo);
    const audio = [...(audioOnly.length > 0 ? audioOnly : candidates)].sort(compareAudio)[0];
    if (audio) selected.push(audio);
    strategy = options.mp3
      ? `best audio converted to MP3 at ${String(options.quality ?? "192K")}`
      : "best native audio";
  }

  const knownSizes = selected.map((format) => format.fileSizeBytes);
  const completeEstimate = selected.length > 0 && knownSizes.every(Number.isFinite);
  const approximate = selected.some((format) => format.sizeKind === "approximate");
  const estimatedSizeBytes = completeEstimate
    ? knownSizes.reduce((total, size) => total + size, 0)
    : null;

  return {
    selection: {
      mode: videoMode ? "video" : options.mp3 ? "mp3" : "audio",
      requestedQuality: videoMode
        ? options.maxHeight == null
          ? "best"
          : `${options.maxHeight}p`
        : options.mp3
          ? String(options.quality ?? "192K")
          : "native",
      strategy,
      formatIds: selected.map((format) => format.id).filter(Boolean),
      formats: selected,
    },
    estimate: {
      bytes: estimatedSizeBytes,
      basis: !completeEstimate
        ? "unavailable"
        : approximate
          ? "approximate"
          : "reported",
      note: videoMode && selected.length > 1
        ? "Combined size of the selected video and audio streams before muxing."
        : options.mp3
          ? "Input stream size; the converted MP3 size may differ."
          : "Selected source stream size.",
    },
  };
}

export function normalizeFormat(format = {}) {
  const videoCodec = codecOrNull(format.vcodec);
  const audioCodec = codecOrNull(format.acodec);
  const reportedSize = positiveNumberOrNull(format.filesize);
  const approximateSize = positiveNumberOrNull(format.filesize_approx);

  return {
    id: textOrNull(format.format_id),
    extension: textOrNull(format.ext),
    resolution: textOrNull(format.resolution)
      ?? (Number.isFinite(format.height) ? `${format.height}p` : null),
    width: finiteOrNull(format.width),
    height: finiteOrNull(format.height),
    fps: finiteOrNull(format.fps),
    videoCodec,
    audioCodec,
    audioBitrateKbps: finiteOrNull(format.abr),
    totalBitrateKbps: finiteOrNull(format.tbr),
    fileSizeBytes: reportedSize ?? approximateSize,
    sizeKind: reportedSize != null
      ? "reported"
      : approximateSize != null
        ? "approximate"
        : "unavailable",
    hasVideo: videoCodec != null,
    hasAudio: audioCodec != null,
  };
}

export function runYtDlpJson(
  command,
  args,
  { spawnFn = spawn, operation = "read metadata" } = {},
) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnFn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
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
          `yt-dlp could not ${operation}` +
            (stderr.trim() ? `\n${stderr.trim()}` : ""),
        );
        error.exitCode = code ?? 1;
        reject(error);
        return;
      }

      try {
        resolvePromise(parseJsonPayload(stdout));
      } catch {
        reject(new Error(`Could not parse yt-dlp JSON while trying to ${operation}.`));
      }
    });
  });
}

function normalizeCaptionLanguages(captions) {
  if (!captions || typeof captions !== "object" || Array.isArray(captions)) return [];

  return Object.entries(captions)
    .map(([language, tracks]) => ({
      language,
      formats: [...new Set(
        (Array.isArray(tracks) ? tracks : [])
          .map((track) => textOrNull(track?.ext))
          .filter(Boolean),
      )].sort(),
      trackCount: Array.isArray(tracks) ? tracks.length : 0,
    }))
    .sort((left, right) => left.language.localeCompare(right.language));
}

function normalizeHistoryMatch(value) {
  if (value == null || value === false) {
    return { matched: false, artifact: null, files: [], timestamp: null };
  }

  if (value === true) {
    return { matched: true, artifact: null, files: [], timestamp: null };
  }

  const entry = value.entry && typeof value.entry === "object" ? value.entry : value;
  return {
    matched: value.matched ?? true,
    artifact: textOrNull(entry.artifact),
    files: Array.isArray(entry.files)
      ? entry.files.filter((file) => typeof file === "string")
      : [],
    timestamp: textOrNull(entry.ts),
  };
}

function requiresFfmpeg(options) {
  return (
    options.mp3 === true ||
    options.normalize === true ||
    options.splitChapters === true ||
    options.embedThumbnail === true ||
    (Array.isArray(options.clips) && options.clips.length > 0) ||
    options.video === true
  );
}

function toolRequirement(name, required, availability, reason) {
  return {
    name,
    required,
    available: typeof availability === "boolean" ? availability : null,
    reason,
  };
}

function compareVideo(left, right) {
  return (
    (right.height ?? -1) - (left.height ?? -1) ||
    Number(right.hasAudio) - Number(left.hasAudio) ||
    (right.totalBitrateKbps ?? -1) - (left.totalBitrateKbps ?? -1)
  );
}

function compareAudio(left, right) {
  return (
    (right.audioBitrateKbps ?? -1) - (left.audioBitrateKbps ?? -1) ||
    (right.totalBitrateKbps ?? -1) - (left.totalBitrateKbps ?? -1)
  );
}

function canonicalMediaUrl(media) {
  for (const candidate of [media.webpage_url, media.original_url, media.url]) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  return media.id ? `https://www.youtube.com/watch?v=${media.id}` : null;
}

function parseJsonPayload(value) {
  if (value && typeof value === "object") return value;
  const parsed = JSON.parse(String(value));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("yt-dlp JSON must describe an object");
  }
  return parsed;
}

function normalizeSearchLimit(value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_RESULTS) {
    throw usageError(`search limit must be an integer from 1 to ${MAX_SEARCH_RESULTS}`);
  }
  return limit;
}

function requireText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw usageError(`${label} cannot be empty`);
  return text;
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function codecOrNull(value) {
  return typeof value === "string" && value !== "none" && value.trim()
    ? value
    : null;
}

function finiteOrNull(value) {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumberOrNull(value) {
  const number = finiteOrNull(value);
  return number != null && number >= 0 ? number : null;
}

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}
