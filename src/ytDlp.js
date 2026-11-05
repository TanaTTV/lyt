import { join } from "node:path";
import { ytDlpJsRuntimeArgs } from "./jsRuntime.js";
import { resolveHeight } from "./quality.js";
import { describeCollectionUrl } from "./urls.js";

const DEFAULT_OUTPUT_TEMPLATE = "%(title).180B [%(id)s].%(ext)s";

/**
 * Flags that consume the next argv token as a value. Shared with entry.js so
 * URL dedupe does not treat option values as media URLs.
 */
export const VALUE_OPTIONS = new Set([
  "--clip",
  "--profile",
  "-o",
  "--output-dir",
  "-q",
  "--quality",
  "-f",
  "--fragments",
  "-j",
  "--jobs",
  "--template",
  "--max-height",
  "--downloader",
  "--downloader-args",
  "--max-filesize",
  "--sub-langs",
  "--cookies-from-browser",
  "--cookies",
  "-r",
  "--limit-rate",
  "--retries",
  "-a",
  "--batch-file",
  "--audio-format",
  "--container",
  "-n",
  "--name",
  "--chapter",
  "--items",
  "--max-items",
  "--after",
  "--before",
  "--min-duration",
  "--max-duration",
]);

export const AUDIO_FORMATS = ["native", "mp3", "m4a", "opus", "wav", "flac"];
const LOSSY_AUDIO_FORMATS = new Set(["mp3", "m4a", "opus"]);
export const VIDEO_CONTAINERS = ["mp4", "mkv", "mov"];
// Most editors (Premiere, Resolve, Final Cut, CapCut) import H.264 + AAC in
// MP4 without a transcode; VP9/AV1/Opus often need one first.
export const EDITOR_FORMAT_SORT = "vcodec:h264,res,acodec:aac";
export const POLITE_SLEEP_ARGS = ["--sleep-requests", "1", "--sleep-interval", "3", "--max-sleep-interval", "8"];
const MEDIA_EXTENSION = /\.(?:mp4|mkv|mov|webm|m4a|mp3|opus|ogg|wav|flac|aac)$/i;

export function parseArgs(argv) {
  const options = {};
  const urls = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      // Everything after `--` is a positional URL, even if it starts with "-".
      for (index += 1; index < argv.length; index += 1) {
        urls.push(requireUrl(argv[index]));
      }
      break;
    }

    if (arg === "-h" || arg === "--help") {
      return { help: true, options, urls };
    }

    if (arg === "-v" || arg === "--version") {
      return { version: true, options, urls };
    }

    if (arg === "-i" || arg === "--interactive") {
      options.interactive = true;
      continue;
    }

    if (arg === "--mp3") {
      options.mp3 = true;
      options.audioFormat = "mp3";
      continue;
    }

    if (arg === "--native") {
      options.mp3 = false;
      options.audioFormat = "native";
      continue;
    }

    if (arg === "--audio-format") {
      options.audioFormat = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--editor" || arg === "--h264") {
      options.video = true;
      options.editor = true;
      continue;
    }

    if (arg === "--container") {
      options.container = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "-n" || arg === "--name") {
      options.name = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--thumbnail") {
      options.writeThumbnail = true;
      continue;
    }

    if (arg === "--info-json") {
      options.infoJson = true;
      continue;
    }

    if (arg === "--chapter") {
      (options.chapters ??= []).push(readValue(argv, ++index, arg));
      continue;
    }

    if (arg === "--items") {
      options.items = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--max-items") {
      options.maxItems = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--after") {
      options.dateAfter = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--before") {
      options.dateBefore = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--min-duration") {
      options.minDuration = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--max-duration") {
      options.maxDuration = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--wait") {
      options.waitForVideo = true;
      continue;
    }

    if (arg === "--polite") {
      options.polite = true;
      continue;
    }

    if (arg === "--video") {
      options.video = true;
      continue;
    }

    if (arg === "--audio") {
      options.video = false;
      continue;
    }

    if (arg === "--playlist") {
      options.playlist = true;
      continue;
    }

    if (arg === "--no-playlist") {
      options.playlist = false;
      continue;
    }

    if (arg === "--no-part") {
      options.noPart = true;
      continue;
    }

    if (arg === "--list-formats" || arg === "-L") {
      options.listFormats = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--print-command") {
      options.printCommand = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--embed-metadata") {
      options.embedMetadata = true;
      continue;
    }

    if (arg === "--embed-thumbnail") {
      options.embedThumbnail = true;
      continue;
    }

    if (arg === "--continue") {
      options.continueDownloads = true;
      continue;
    }

    if (arg === "--force-overwrite") {
      options.forceOverwrite = true;
      continue;
    }

    if (arg === "--no-download") {
      options.noDownload = true;
      continue;
    }

    if (arg === "--clip") {
      // Clip ranges can start with "-" (open start, e.g. "-2:45").
      (options.clips ??= []).push(readValue(argv, ++index, arg, { allowDash: true }));
      continue;
    }

    if (arg === "--split-chapters") {
      options.splitChapters = true;
      continue;
    }

    if (arg === "--normalize") {
      options.normalize = true;
      options.normalizeExplicit = true;
      continue;
    }

    if (arg === "--no-normalize") {
      options.normalize = false;
      options.normalizeExplicit = true;
      continue;
    }

    if (arg === "-p" || arg === "--paste") {
      options.paste = true;
      continue;
    }

    if (arg === "--watch" || arg === "--queue") {
      options.watch = true;
      continue;
    }

    if (arg === "--redownload") {
      options.redownload = true;
      continue;
    }

    if (arg === "--no-history") {
      options.history = false;
      continue;
    }

    if (arg === "--profile") {
      options.profile = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "-o" || arg === "--output-dir") {
      options.outputDir = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "-q" || arg === "--quality") {
      options.quality = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "-f" || arg === "--fragments") {
      options.fragments = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "-j" || arg === "--jobs") {
      options.jobs = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--template") {
      options.template = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--max-height") {
      options.maxHeight = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--downloader") {
      options.downloader = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--downloader-args") {
      // Downloader args routinely start with "-" (e.g. "-x16 -s16"), so allow it.
      options.downloaderArgs = readValue(argv, ++index, arg, { allowDash: true });
      continue;
    }

    if (arg === "--max-filesize") {
      options.maxFilesize = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--history") {
      options.history = true;
      continue;
    }

    if (arg === "--subs") {
      options.subs = true;
      continue;
    }

    if (arg === "--no-subs") {
      options.subs = false;
      options.embedSubs = false;
      continue;
    }

    if (arg === "--sub-langs") {
      options.subs = true;
      options.subLangs = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--embed-subs") {
      options.subs = true;
      options.embedSubs = true;
      continue;
    }

    if (arg === "--sponsorblock") {
      options.sponsorblock = true;
      continue;
    }

    if (arg === "--no-sponsorblock") {
      options.sponsorblock = false;
      continue;
    }

    if (arg === "--cookies-from-browser") {
      options.cookiesFromBrowser = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--cookies") {
      options.cookies = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--limit-rate" || arg === "-r") {
      options.limitRate = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "--retries") {
      options.retries = readValue(argv, ++index, arg);
      continue;
    }

    if (arg === "-a" || arg === "--batch-file") {
      // "-" reads URLs from standard input.
      (options.batchFiles ??= []).push(readValue(argv, ++index, arg, { allowDash: true }));
      continue;
    }

    if (arg === "--sync") {
      options.sync = true;
      continue;
    }

    if (arg.startsWith("-")) {
      const error = new Error(`Unknown option: ${arg}`);
      error.exitCode = 2;
      throw error;
    }

    urls.push(requireUrl(arg));
  }

  return { options, urls };
}

export function normalizeOptions(options = {}) {
  const video = options.video ?? false;

  // In video mode, -q/--quality (and --max-height) pick a resolution, e.g.
  // "1080p" or "4k". In audio mode, -q/--quality is the MP3 bitrate.
  let maxHeight = null;

  if (video) {
    const token = options.maxHeight ?? options.quality;
    maxHeight = token != null ? resolveHeight(token) : null;
  }

  if (options.normalize && video && options.normalizeExplicit) {
    const error = new Error(
      "--normalize works in audio mode only (it re-encodes the audio track).",
    );
    error.exitCode = 2;
    throw error;
  }

  const normalize = video ? false : (options.normalize ?? false);
  // Video downloads keep the muxed file; audio extraction never applies.
  // Loudness normalization needs an ffmpeg encode step, so with no explicit
  // format it implies MP3.
  let audioFormat = video
    ? "native"
    : normalizeAudioFormat(options.audioFormat ?? (options.mp3 ? "mp3" : "native"));
  if (normalize && audioFormat === "native") audioFormat = "mp3";
  const lossy = LOSSY_AUDIO_FORMATS.has(audioFormat) || audioFormat === "native";
  const durationFilter = buildDurationFilter(options.minDuration, options.maxDuration);
  const name = normalizeName(options.name);

  return {
    video,
    mp3: audioFormat === "mp3",
    // null keeps the native stream; otherwise yt-dlp converts with ffmpeg.
    audioFormat: audioFormat === "native" ? null : audioFormat,
    editor: video ? (options.editor ?? false) : false,
    container: video ? normalizeChoice(options.container ?? "mp4", VIDEO_CONTAINERS, "--container") : null,
    name,
    writeThumbnail: options.writeThumbnail ?? false,
    infoJson: options.infoJson ?? false,
    chapters: (options.chapters ?? []).map(normalizeChapter),
    items: options.items == null ? null : normalizeItems(options.items),
    maxItems: options.maxItems == null ? null : normalizePositiveInteger(options.maxItems, "--max-items"),
    dateAfter: options.dateAfter == null ? null : normalizeDate(options.dateAfter, "--after"),
    dateBefore: options.dateBefore == null ? null : normalizeDate(options.dateBefore, "--before"),
    durationFilter,
    waitForVideo: options.waitForVideo ?? false,
    polite: options.polite ?? false,
    maxHeight,
    normalize,
    clips: (options.clips ?? []).map(parseClip),
    splitChapters: options.splitChapters ?? false,
    paste: options.paste ?? false,
    watch: options.watch ?? false,
    redownload: options.redownload ?? false,
    history: options.history ?? true,
    listFormats: options.listFormats ?? false,
    outputDir: options.outputDir ?? "downloads",
    // Lossless formats (WAV, FLAC) have no bitrate to choose.
    quality: video || !lossy ? null : normalizeQuality(options.quality ?? "192K"),
    fragments: normalizePositiveInteger(options.fragments ?? 8, "fragments"),
    jobs: normalizePositiveInteger(options.jobs ?? 1, "jobs"),
    playlist: options.playlist ?? false,
    noPart: options.noPart ?? false,
    dryRun: options.dryRun ?? false,
    printCommand: options.printCommand ?? false,
    json: options.json ?? false,
    interactive: options.interactive ?? false,
    embedMetadata: options.embedMetadata ?? false,
    embedThumbnail: options.embedThumbnail ?? false,
    continueDownloads: options.continueDownloads ?? true,
    forceOverwrite: options.forceOverwrite ?? false,
    noDownload: options.noDownload ?? false,
    // --name sets the file name; yt-dlp still picks the extension.
    template: name ? `${name}.%(ext)s` : (options.template ?? DEFAULT_OUTPUT_TEMPLATE),
    downloader: options.downloader ?? null,
    downloaderArgs: options.downloaderArgs ?? null,
    maxFilesize: normalizeSize(options.maxFilesize),
    subs: options.subs ?? false,
    subLangs: normalizeSubLangs(options.subLangs),
    // Subtitles can only be embedded in a video container.
    embedSubs: video ? (options.embedSubs ?? false) : false,
    sponsorblock: options.sponsorblock ?? false,
    cookiesFromBrowser: options.cookiesFromBrowser ?? null,
    cookies: options.cookies ?? null,
    limitRate: normalizeRate(options.limitRate),
    retries: options.retries == null ? null : normalizeRetries(options.retries),
    sync: options.sync ?? false,
  };
}

// A YouTube playlist, channel, or SoundCloud set saved with --playlist and the
// default template goes into its own folder, numbered in playlist order.
export const PLAYLIST_OUTPUT_TEMPLATE =
  "%(playlist_title).120B/%(playlist_index)03d - %(title).150B [%(id)s].%(ext)s";

export function usesPlaylistFolder(url, options) {
  return Boolean(
    options.playlist &&
      options.template === DEFAULT_OUTPUT_TEMPLATE &&
      (describeCollectionUrl(url) || /[?&]list=/.test(String(url))),
  );
}

export function buildYtDlpArgs(
  url,
  options,
  { runtimeArgs = ytDlpJsRuntimeArgs() } = {},
) {
  const args = [
    "--newline",
    "--no-warnings",
    ...runtimeArgs,
    options.json ? "--no-progress" : "--progress",
    "--concurrent-fragments",
    String(options.fragments),
    "-f",
    selectFormat(options),
    "-o",
    join(
      options.outputDir,
      usesPlaylistFolder(url, options) ? PLAYLIST_OUTPUT_TEMPLATE : options.template,
    ),
  ];

  if (options.video) {
    // Ensure a single playable file when the best video/audio come separately.
    args.push("--merge-output-format", options.container ?? "mp4");
  }

  if (options.editor) {
    // Prefer H.264 + AAC over resolution: an editor-ready 1080p beats a 4K
    // VP9/AV1 file that has to be transcoded before it can be cut.
    args.push("-S", EDITOR_FORMAT_SORT);
  }

  if (!options.playlist) {
    args.push("--no-playlist");
  }

  if (options.noPart) {
    args.push("--no-part");
  }

  if (options.maxFilesize) {
    args.push("--max-filesize", options.maxFilesize);
  }

  if (options.downloader) {
    args.push("--downloader", options.downloader);

    if (options.downloaderArgs) {
      // yt-dlp expects external downloader args as "NAME:ARGS".
      const value = options.downloaderArgs.includes(":")
        ? options.downloaderArgs
        : `${options.downloader}:${options.downloaderArgs}`;
      args.push("--downloader-args", value);
    }
  } else if (options.downloaderArgs) {
    args.push("--downloader-args", options.downloaderArgs);
  }

  if (options.continueDownloads && !options.forceOverwrite) {
    args.push("--continue", "--no-overwrites");
  }

  if (options.forceOverwrite) {
    args.push("--force-overwrites");
  }

  if (options.audioFormat) {
    args.push("-x", "--audio-format", options.audioFormat);
    if (options.quality) args.push("--audio-quality", options.quality);
  } else if (options.mp3) {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", options.quality);
  }

  if (options.metadata) {
    // Tag the file with known details (e.g. from Spotify) instead of the
    // uploader's video title. "@" keeps one-word values from being read as
    // yt-dlp field names.
    for (const [field, value] of Object.entries(options.metadata)) {
      if (value == null || value === "") continue;
      args.push("--parse-metadata", `@${metadataValue(value)}:^@(?P<meta_${field}>.+)$`);
    }
  }

  if (options.embedMetadata || options.metadata) {
    args.push("--embed-metadata");
  }

  if (options.embedThumbnail) {
    args.push("--embed-thumbnail");

    if (!options.video) {
      // Video thumbnails are 16:9; crop to a centered square so they look
      // like normal cover art in music players.
      args.push(
        "--convert-thumbnails",
        "jpg",
        "--postprocessor-args",
        "ThumbnailsConvertor+ffmpeg_o:-c:v mjpeg -vf crop=\"'if(gt(ih,iw),iw,ih)':'if(gt(iw,ih),ih,iw)'\"",
      );
    }
  }

  if (options.writeThumbnail) {
    args.push("--write-thumbnail");
    // The audio cover-art path above already converts to JPEG.
    if (!(options.embedThumbnail && !options.video)) args.push("--convert-thumbnails", "jpg");
  }

  if (options.infoJson) {
    args.push("--write-info-json");
  }

  if (options.subs) {
    args.push(
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs",
      options.subLangs,
      "--convert-subs",
      "srt",
    );
    if (options.embedSubs) args.push("--embed-subs");
  }

  if (options.sponsorblock) {
    args.push("--sponsorblock-remove", SPONSORBLOCK_CATEGORIES);
  }

  if (options.cookiesFromBrowser) {
    args.push("--cookies-from-browser", options.cookiesFromBrowser);
  }

  if (options.cookies) {
    args.push("--cookies", options.cookies);
  }

  if (options.limitRate) {
    args.push("--limit-rate", options.limitRate);
  }

  if (options.retries != null) {
    args.push("--retries", String(options.retries), "--fragment-retries", String(options.retries));
  }

  // yt-dlp ORs repeated --match-filter flags, so every condition shares one.
  const filters = [options.matchFilter, options.durationFilter].filter(Boolean);
  if (filters.length > 0) {
    args.push("--match-filter", filters.join(" & "));
  }

  if (options.matchFilter) {
    // Take the first search result that passes the filter, then stop.
    args.push("--max-downloads", "1");
  }

  if (options.items) {
    args.push("--playlist-items", options.items);
  }

  if (options.maxItems) {
    args.push("--playlist-end", String(options.maxItems));
  }

  if (options.dateAfter) {
    args.push("--dateafter", options.dateAfter);
  }

  if (options.dateBefore) {
    args.push("--datebefore", options.dateBefore);
  }

  if (options.waitForVideo) {
    // Poll a premiere or scheduled live stream until it starts.
    args.push("--wait-for-video", "60");
  }

  if (options.polite) {
    args.push(...POLITE_SLEEP_ARGS);
  }

  for (const section of options.clips ?? []) {
    args.push("--download-sections", section);
  }

  // A section without a leading "*" is a chapter-title regex in yt-dlp.
  for (const chapter of options.chapters ?? []) {
    args.push("--download-sections", chapter);
  }

  if ((options.clips ?? []).length > 0 || (options.chapters ?? []).length > 0) {
    // Re-encode at the cut points so clips start exactly where asked instead
    // of at the previous keyframe.
    args.push("--force-keyframes-at-cuts");
  }

  if (options.splitChapters) {
    args.push(
      "--split-chapters",
      "-o",
      `chapter:${join(
        options.outputDir,
        "%(title).120B [%(id)s]",
        "%(section_number)02d - %(section_title).120B.%(ext)s",
      )}`,
    );
  }

  if (options.normalize) {
    // Single-pass EBU R128 loudness normalization during the audio encode.
    args.push(
      "--postprocessor-args",
      "ExtractAudio+ffmpeg_o:-af loudnorm=I=-16:TP=-1.5:LRA=11",
    );
  }

  // Isolate the positional URL behind `--` so a URL that looks like a flag
  // (e.g. "--exec=...") can never be interpreted as a yt-dlp option.
  args.push("--", url);
  return args;
}

// Parses a clip range like "1:10-2:45", "90-180", "1:10-" (to the end), or
// "-2:45" (from the start) into yt-dlp's "*START-END" section syntax.
export function parseClip(value) {
  const raw = String(value).trim();
  const match = /^([^-]*)-(.*)$/.exec(raw);
  const start = match?.[1].trim() ?? "";
  const end = match?.[2].trim() ?? "";

  if (!match || (start === "" && end === "")) {
    throw clipError(value);
  }

  if (start !== "" && !isTimestamp(start)) throw clipError(value);
  if (end !== "" && !isTimestamp(end)) throw clipError(value);

  if (start !== "" && end !== "" && toSeconds(start) >= toSeconds(end)) {
    const error = new Error(`clip start must be before its end: ${value}`);
    error.exitCode = 2;
    throw error;
  }

  return `*${start === "" ? "0" : start}-${end === "" ? "inf" : end}`;
}

function isTimestamp(text) {
  return /^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(text);
}

function toSeconds(timestamp) {
  return timestamp
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0);
}

function clipError(value) {
  const error = new Error(
    `clip must look like 1:10-2:45, 90-180, 1:10- or -2:45 (got: ${value}).`,
  );
  error.exitCode = 2;
  return error;
}

function selectFormat(options) {
  if (options.video) {
    const cap = options.maxHeight ? `[height<=${options.maxHeight}]` : "";
    return `bestvideo${cap}+bestaudio/best${cap}`;
  }

  if (options.audioFormat === "m4a") {
    // An AAC source converts to .m4a without re-encoding.
    return "bestaudio[ext=m4a]/bestaudio";
  }

  if (options.audioFormat === "opus") {
    return "bestaudio[acodec=opus]/bestaudio";
  }

  if (options.mp3 || options.audioFormat) {
    return "bestaudio";
  }

  return "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio";
}

function normalizeChoice(value, choices, name) {
  const text = String(value).trim().toLowerCase();
  if (choices.includes(text)) return text;
  throw usageFailure(`Invalid ${name}: ${value}. Use one of: ${choices.join(", ")}.`);
}

function normalizeAudioFormat(value) {
  return normalizeChoice(value, AUDIO_FORMATS, "--audio-format");
}

// A plain file name (no extension) for the output template. "%" is literal.
function normalizeName(value) {
  if (value == null) return null;
  const name = String(value).trim().replace(MEDIA_EXTENSION, "");
  const segments = name.split(/[\\/]/);
  if (
    name === "" ||
    /^[\\/]|^[A-Za-z]:/.test(name) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    /[\0-\x1f]/.test(name)
  ) {
    throw usageFailure(
      `Invalid --name: ${value}. Use a file name like "interview-clip" (relative, no "..").`,
    );
  }
  return name.replaceAll("%", "%%");
}

// Case-insensitive chapter-title match; the text is literal, not a regex.
function normalizeChapter(value) {
  const text = String(value).trim();
  if (text === "") throw usageFailure("--chapter needs a chapter title (or part of one).");
  return `(?i)${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
}

function normalizeItems(value) {
  const text = String(value).replace(/\s+/g, "");
  if (/^(?:\d+(?:[-:]\d*)?|[-:]\d+)(?:,(?:\d+(?:[-:]\d*)?|[-:]\d+))*$/.test(text)) {
    // yt-dlp uses ":" for ranges; "-" is accepted as the friendlier spelling.
    return text.replace(/(\d)-(?=\d|,|$)/g, "$1:").replace(/^-(?=\d)/, ":").replace(/,-(?=\d)/g, ",:");
  }
  throw usageFailure(`Invalid --items: ${value}. Use positions like 1-5, 3,7,9, or 10-.`);
}

function normalizeDate(value, name) {
  const text = String(value).trim().toLowerCase();
  if (/^\d{8}$/.test(text)) return text;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  if (/^(?:now|today|yesterday)(?:-\d+(?:day|week|month|year)s?)?$/.test(text)) return text;
  throw usageFailure(`Invalid ${name}: ${value}. Use 2026-01-31, 20260131, or today-7days.`);
}

function durationSeconds(value, name) {
  const text = String(value).trim();
  if (isTimestamp(text)) return toSeconds(text);
  throw usageFailure(`Invalid ${name}: ${value}. Use seconds (90) or a time like 1:30 or 1:02:00.`);
}

function buildDurationFilter(min, max) {
  const low = min == null ? null : durationSeconds(min, "--min-duration");
  const high = max == null ? null : durationSeconds(max, "--max-duration");
  if (low != null && high != null && low > high) {
    throw usageFailure("--min-duration must not be longer than --max-duration.");
  }
  // "?" lets media with unknown duration through instead of silently dropping it.
  const parts = [];
  if (low != null) parts.push(`duration >=? ${low}`);
  if (high != null) parts.push(`duration <=? ${high}`);
  return parts.length > 0 ? parts.join(" & ") : null;
}

function usageFailure(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

export function formatCommand(command, args) {
  return `# argv: ${[command, ...args].map(escapeDisplayArg).join(" ")}`;
}

export function usage() {
  return `Usage:
  lyt [options] <url> [more-urls...]

Aliases (optional):
  yt3 <url>   same as lyt with audio defaults
  yt4 <url>   same as lyt with video defaults

Audio (default):
  lyt "https://www.youtube.com/watch?v=..."

MP3 conversion:
  lyt --mp3 -q 192K "https://www.youtube.com/watch?v=..."

Video at a chosen quality:
  lyt --video -q 1080p "https://www.youtube.com/watch?v=..."

Zero typing — download straight from the clipboard:
  lyt                      with a link already copied (interactive terminal)
  lyt --paste              always read the clipboard (scripts and non-TTY too)
  lyt --watch              keep watching the clipboard; grab links as you copy

Spotify playlist → songs (each track is matched on YouTube, saved as MP3):
  lyt "https://open.spotify.com/playlist/..."   (albums, tracks, and artists
                            work too; re-run to fetch only newly added songs)
  lyt --sync "https://open.spotify.com/playlist/..."   renumber to the current
                            order and move removed songs to a "removed" folder
  Songs are tagged and get cover art; a .m3u8 playlist file is written. For
  playlists over 100 songs, set Spotify API keys (free developer app):
    lyt config set spotify-client-id <id>
    lyt config set spotify-client-secret <secret>

Other sites: SoundCloud, Vimeo, Bandcamp, and anything yt-dlp supports.
  Playlists, channels, sets, and profiles need --playlist (saved into a
  numbered folder).

Grab just a slice of a long video:
  lyt --clip 1:10-2:45 "URL"        (repeat --clip for multiple slices)

Video for an editing project (H.264 MP4 that editors import as-is):
  lyt --editor --clip 1:10-2:45 --name broll-intro "URL"
  lyt --profile edit "URL"

Subcommands:
  lyt search "query"        Find YouTube candidates; never downloads media
                            (--limit 1-25; --json → lyt.search.v1)
  lyt info <url>            Media metadata and formats without downloading
                            (alias: lyt inspect; --json → lyt.info.v1)
                            --jobs 1-16 controls inspection workers (default: 3)
  lyt transcript <url>      Subtitles or automatic captions as clean text
                            (--timestamps, --lang es; --json → lyt.transcript.v1)
  lyt last [query]          Paths of the newest download (--open, --reveal)
  lyt update                Refresh yt-dlp (same as lyt doctor --update)
  lyt mcp                   Run as an MCP server over stdio for AI clients
  lyt completion <shell>    Tab completion for bash, zsh, or fish
  lyt capabilities          Commands, modes, flags, and result schemas
                            (--json → lyt.capabilities.v1)
  lyt history [query]       List/search past downloads (--clear wipes)
  lyt config <cmd>          Persistent defaults: set/get/unset/list/path
  lyt doctor                Check the environment (--fix installs missing
                            tools, --update self-updates yt-dlp; also reports
                            when a newer lyt release is on npm; --check-updates
                            refreshes cached release information; --network
                            checks that YouTube, Spotify, SoundCloud, and
                            GitHub are reachable)
  lyt agent install [name]  Install the lyt skill for codex, claude, or all
                            (optional: --home <dir>)

Options:
  --mp3                     Convert extracted audio to MP3 with ffmpeg
  --native                  Save native audio stream when possible (default)
  --audio-format <fmt>      Audio output: native, mp3, m4a, opus, wav, flac
  --video                   Download video (best video+audio, muxed to mp4)
  --editor, --h264          Video for editing: prefer H.264 + AAC in MP4 so
                            Premiere, Resolve, Final Cut, and CapCut import it
                            without a transcode (often 1080p on YouTube)
  --container <fmt>         Video container: mp4 (default), mkv, or mov
  -n, --name <name>         Output file name without extension (one URL)
  --audio                   Download audio only (default)
  -q, --quality <value>     Audio: MP3 bitrate (128K/192K/320K) or VBR level
                            0-10 (0 = best). Video: a
                            resolution like 1080p, 720p, 4k, 8k, or best
  --max-height <value>      Cap video resolution (alias of -q in video mode)
  -L, --list-formats        List the qualities available for each URL and exit
  --clip <start-end>        Download only this section, e.g. 1:10-2:45, 90-180,
                            1:10- (to end), -2:45 (from start); repeatable
  --chapter <text>          Download only chapters whose title contains this
                            text (case-insensitive); repeatable
  --split-chapters          Split into one file per chapter, named by chapter
  --normalize               Loudness-normalize audio (EBU R128; implies --mp3)
  --no-normalize            Disable normalization inherited from config/profile
  --subs                    Save subtitles (manual, else automatic) as .srt
  --sub-langs <langs>       Subtitle languages, e.g. en or "en.*,de" (default: en)
  --embed-subs              Embed subtitles in the video file (video mode)
  --no-subs                 Disable subtitles inherited from config
  --sponsorblock            Cut sponsor, self-promo, and interaction segments
  --no-sponsorblock         Disable SponsorBlock inherited from config
  --thumbnail               Save the thumbnail as a .jpg next to the media
  --info-json               Save yt-dlp's .info.json metadata next to the media
  -p, --paste               Add media URL(s) from the clipboard (always;
                            interactive terminals also auto-read when no URL)
  --watch, --queue          Watch the clipboard and download every copied link
  -a, --batch-file <file>   Read URLs from a file, one per line (- for stdin)
  --profile <name>          Preset bundle: music, podcast, voice, or edit
  --sync                    Spotify: renumber saved songs, move removed ones aside
  --redownload              Download even if the video is already in history
  --no-history              Skip recording this run in the download history
  --history                 Record history even if config turned it off
  -f, --fragments <n>       Concurrent fragments per download (default: 8)
  -j, --jobs <n>            Parallel downloads for multiple URLs (default: 1)
  -o, --output-dir <dir>    Output directory (default: downloads)
  --template <template>     yt-dlp output template
  --downloader <name>       External downloader, e.g. aria2c (faster on throttled hosts)
  --downloader-args <args>  Args for the external downloader, e.g. "-x16 -s16 -k1M"
  --max-filesize <size>     Skip media larger than a yt-dlp size such as 2G
  -r, --limit-rate <rate>   Cap download speed, e.g. 500K or 2M
  --retries <n>             Retries for downloads and fragments (0-100)
  --cookies-from-browser <browser>
                            Use your browser's cookies (e.g. chrome, firefox)
                            for media your account can access
  --cookies <file>          Use a Netscape-format cookies file
  --no-part                 Write directly to the output file (skip .part)
  --playlist                Allow playlists, channels, sets, and profiles
  --items <list>            Playlist positions, e.g. 1-5,8 or 10- (with --playlist)
  --max-items <n>           Stop after n playlist entries
  --after <date>            Only media uploaded on/after 2026-01-31 or today-7days
  --before <date>           Only media uploaded on/before a date
  --min-duration <time>     Skip media shorter than this (90 or 1:30)
  --max-duration <time>     Skip media longer than this
  --wait                    Wait for a premiere or scheduled stream to start
  --polite                  Pause between requests (helps with rate limits)
  --no-playlist             Download only the single video URL (default)
  --embed-metadata          Embed metadata; may add time
  --embed-thumbnail         Embed thumbnail; may add time
  --force-overwrite         Replace existing files
  --no-download             Require yt-dlp/ffmpeg on PATH; skip auto-install
  --print-command           Print an inert yt-dlp argv preview before running
  --dry-run                 Print commands without running
  --json                    Emit stable lyt.result.v1 JSON with final paths
  -i, --interactive         Prompt for options interactively
  -h, --help                Show this help
  -v, --version             Show version (and an update hint when available)

Update checks:
  After human downloads and on doctor/--version, lyt may check npm for a newer
  release (cached ~6h; failed checks back off ~5m). Disable with LYT_NO_UPDATE_CHECK=1 or:
    lyt config set update-check false`;
}

function requireUrl(value) {
  if (value === undefined || value.trim() === "") {
    const error = new Error("Empty URL argument.");
    error.exitCode = 2;
    throw error;
  }

  return value;
}

function readValue(argv, index, optionName, { allowDash = false } = {}) {
  const value = argv[index];

  if (value === undefined || (!allowDash && value.startsWith("-"))) {
    const error = new Error(`${optionName} needs a value.`);
    error.exitCode = 2;
    throw error;
  }

  return value;
}

function normalizeQuality(value) {
  const quality = String(value).trim();

  // yt-dlp reads bare 0-10 as a VBR level (0 = best). Larger bare numbers
  // only make sense as a bitrate, so "320" means "320K".
  if (/^\d+$/.test(quality)) {
    return Number(quality) > 10 ? `${Number(quality)}K` : String(Number(quality));
  }

  if (/^\d+[kK]$/.test(quality)) {
    return quality.toUpperCase();
  }

  const error = new Error("quality must look like 128K, 192K, 320K, or 0.");
  error.exitCode = 2;
  throw error;
}

function normalizeSize(value) {
  if (value == null) return null;
  const size = String(value).trim();

  if (/^\d+(?:\.\d+)?[kKmMgGtTpP]?$/.test(size)) {
    return size;
  }

  const error = new Error(
    `Invalid max filesize: ${value}. Use bytes or a value such as 500M or 2G.`,
  );
  error.exitCode = 2;
  throw error;
}

export const SPONSORBLOCK_CATEGORIES = "sponsor,selfpromo,interaction";

function normalizeSubLangs(value) {
  // Plain "en": "en.*" also pulls machine translations, which YouTube
  // often rate-limits.
  if (value == null) return "en";
  const langs = String(value).trim();

  if (/^[\w.*,@+-]+$/.test(langs)) return langs;

  const error = new Error(`Invalid --sub-langs: ${value}. Use codes like en, es, or "en.*,de".`);
  error.exitCode = 2;
  throw error;
}

function normalizeRate(value) {
  if (value == null) return null;
  const rate = String(value).trim().replace(/\/s$/i, "");

  if (/^\d+(?:\.\d+)?[kKmMgG]?$/.test(rate)) return rate;

  const error = new Error(`Invalid --limit-rate: ${value}. Use a speed such as 500K or 2M.`);
  error.exitCode = 2;
  throw error;
}

function normalizeRetries(value) {
  const text = String(value).trim();

  if (text === "infinite") return text;
  if (/^\d+$/.test(text) && Number(text) <= 100) return Number(text);

  const error = new Error(`Invalid --retries: ${value}. Use a number from 0 to 100.`);
  error.exitCode = 2;
  throw error;
}

// Literal text for a --parse-metadata source: % and : have meaning there.
function metadataValue(value) {
  return String(value)
    .replace(/[\r\n]+/g, " ")
    .replaceAll("\\", "")
    .replaceAll("%", "%%")
    .replaceAll(":", "\\:");
}

function normalizePositiveInteger(value, name) {
  const str = String(value).trim();
  const parsed = Number(str);

  if (!/^\d+$/.test(str) || !Number.isInteger(parsed) || parsed < 1) {
    const error = new Error(`${name} must be a positive integer.`);
    error.exitCode = 2;
    throw error;
  }

  return parsed;
}

function escapeDisplayArg(arg) {
  return [...String(arg)].map((character) =>
    /^[A-Za-z0-9_./:=-]$/.test(character)
      ? character
      : `\\u{${character.codePointAt(0).toString(16)}}`
  ).join("");
}
