import { join } from "node:path";
import { ytDlpJsRuntimeArgs } from "./jsRuntime.js";
import { resolveHeight } from "./quality.js";

const DEFAULT_OUTPUT_TEMPLATE = "%(title).180B [%(id)s].%(ext)s";

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
      continue;
    }

    if (arg === "--native") {
      options.mp3 = false;
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

  return {
    video,
    // Video downloads keep the muxed file; audio extraction never applies.
    // Loudness normalization needs an ffmpeg encode step, so it implies MP3.
    mp3: video ? false : (normalize ? true : (options.mp3 ?? false)),
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
    quality: video ? null : normalizeQuality(options.quality ?? "192K"),
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
    template: options.template ?? DEFAULT_OUTPUT_TEMPLATE,
    downloader: options.downloader ?? null,
    downloaderArgs: options.downloaderArgs ?? null,
    maxFilesize: normalizeSize(options.maxFilesize),
  };
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
    join(options.outputDir, options.template),
  ];

  if (options.video) {
    // Ensure a single playable file when the best video/audio come separately.
    args.push("--merge-output-format", "mp4");
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

  if (options.mp3) {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", options.quality);
  }

  if (options.embedMetadata) {
    args.push("--embed-metadata");
  }

  if (options.embedThumbnail) {
    args.push("--embed-thumbnail");
  }

  for (const section of options.clips ?? []) {
    args.push("--download-sections", section);
  }

  if ((options.clips ?? []).length > 0) {
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

  if (options.mp3) {
    return "bestaudio";
  }

  return "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio";
}

export function formatCommand(command, args) {
  return `# argv: ${[command, ...args].map(escapeDisplayArg).join(" ")}`;
}

export function usage() {
  return `Usage:
  lyt [options] <youtube-url> [more-urls...]
  yt3 <url>   audio shortcut        yt4 <url>   video shortcut

Audio (default):
  lyt "https://www.youtube.com/watch?v=..."

MP3 conversion:
  lyt --mp3 -q 192K "https://www.youtube.com/watch?v=..."

Video at a chosen quality:
  yt4 -q 1080p "https://www.youtube.com/watch?v=..."

Zero typing — download straight from the clipboard:
  yt3 --paste              download every YouTube link on the clipboard
  yt3 --watch              keep watching the clipboard; grab links as you copy

Grab just a slice of a long video:
  yt3 --clip 1:10-2:45 "URL"        (repeat --clip for multiple slices)

Subcommands:
  lyt history [query]       List/search past downloads (--clear wipes)
  lyt config <cmd>          Persistent defaults: set/get/unset/list/path
  lyt doctor                Check the environment (--fix installs missing
                            tools, --update self-updates yt-dlp)
  lyt agent install [name]  Install the lyt skill for codex, claude, or all
                            (optional: --home <dir>)

Options:
  --mp3                     Convert extracted audio to MP3 with ffmpeg
  --native                  Save native audio stream when possible (default)
  --video                   Download video (best video+audio, muxed to mp4)
  --audio                   Download audio only (default)
  -q, --quality <value>     Audio: MP3 bitrate (128K/192K/320K/0). Video: a
                            resolution like 1080p, 720p, 4k, 8k, or best
  --max-height <value>      Cap video resolution (alias of -q in video mode)
  -L, --list-formats        List the qualities available for each URL and exit
  --clip <start-end>        Download only this section, e.g. 1:10-2:45, 90-180,
                            1:10- (to end), -2:45 (from start); repeatable
  --split-chapters          Split into one file per chapter, named by chapter
  --normalize               Loudness-normalize audio (EBU R128; implies --mp3)
  --no-normalize            Disable normalization inherited from config/profile
  -p, --paste               Add YouTube URL(s) found on the clipboard
  --watch, --queue          Watch the clipboard and download every copied link
  --profile <name>          Preset bundle: music, podcast, or voice
  --redownload              Download even if the video is already in history
  --no-history              Skip recording this run in the download history
  -f, --fragments <n>       Concurrent fragments per download (default: 8)
  -j, --jobs <n>            Parallel downloads for multiple URLs (default: 1)
  -o, --output-dir <dir>    Output directory (default: downloads)
  --template <template>     yt-dlp output template
  --downloader <name>       External downloader, e.g. aria2c (faster on throttled hosts)
  --downloader-args <args>  Args for the external downloader, e.g. "-x16 -s16 -k1M"
  --max-filesize <size>     Skip media larger than a yt-dlp size such as 2G
  --no-part                 Write directly to the output file (skip .part)
  --playlist                Allow playlist downloads
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
  -v, --version             Show version`;
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

  if (/^\d+$/.test(quality) || /^\d+[kK]$/.test(quality)) {
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
