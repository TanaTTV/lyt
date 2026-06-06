import { join } from "node:path";

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

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--print-command") {
      options.printCommand = true;
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

  return {
    video,
    // Video downloads keep the muxed file; audio extraction never applies.
    mp3: video ? false : (options.mp3 ?? false),
    maxHeight: video && options.maxHeight != null
      ? normalizePositiveInteger(options.maxHeight, "max-height")
      : null,
    outputDir: options.outputDir ?? "downloads",
    quality: normalizeQuality(options.quality ?? "192K"),
    fragments: normalizePositiveInteger(options.fragments ?? 8, "fragments"),
    jobs: normalizePositiveInteger(options.jobs ?? 1, "jobs"),
    playlist: options.playlist ?? false,
    noPart: options.noPart ?? false,
    dryRun: options.dryRun ?? false,
    printCommand: options.printCommand ?? false,
    interactive: options.interactive ?? false,
    embedMetadata: options.embedMetadata ?? false,
    embedThumbnail: options.embedThumbnail ?? false,
    continueDownloads: options.continueDownloads ?? true,
    forceOverwrite: options.forceOverwrite ?? false,
    template: options.template ?? DEFAULT_OUTPUT_TEMPLATE,
    downloader: options.downloader ?? null,
    downloaderArgs: options.downloaderArgs ?? null,
  };
}

export function buildYtDlpArgs(url, options) {
  const args = [
    "--newline",
    "--no-warnings",
    "--progress",
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

  // Isolate the positional URL behind `--` so a URL that looks like a flag
  // (e.g. "--exec=...") can never be interpreted as a yt-dlp option.
  args.push("--", url);
  return args;
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
  return [command, ...args].map(quoteArg).join(" ");
}

export function usage() {
  return `Usage:
  yt2audio [options] <youtube-url> [more-urls...]

Fast native audio by default:
  yt2audio "https://www.youtube.com/watch?v=..."

MP3 conversion:
  yt2audio --mp3 -q 192K "https://www.youtube.com/watch?v=..."

Interactive mode (also auto-starts when run with no URL in a terminal):
  yt2audio -i

Options:
  --mp3                     Convert extracted audio to MP3 with ffmpeg
  --native                  Save native audio stream when possible (default)
  --video                   Download video (best video+audio, muxed to mp4)
  --audio                   Download audio only (default)
  --max-height <n>          Cap video resolution, e.g. 1080 or 720 (video mode)
  -q, --quality <value>     MP3 quality, e.g. 128K, 192K, 320K, or 0 (default: 192K)
  -f, --fragments <n>       Concurrent fragments per download (default: 8)
  -j, --jobs <n>            Parallel downloads for multiple URLs (default: 1)
  -o, --output-dir <dir>    Output directory (default: downloads)
  --template <template>     yt-dlp output template
  --downloader <name>       External downloader, e.g. aria2c (faster on throttled hosts)
  --downloader-args <args>  Args for the external downloader, e.g. "-x16 -s16 -k1M"
  --no-part                 Write directly to the output file (skip .part)
  --playlist                Allow playlist downloads
  --no-playlist             Download only the single video URL (default)
  --embed-metadata          Embed metadata; may add time
  --embed-thumbnail         Embed thumbnail; may add time
  --force-overwrite         Replace existing files
  --print-command           Print yt-dlp commands before running
  --dry-run                 Print commands without running
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

function quoteArg(arg) {
  if (/^[A-Za-z0-9_./:=%[\]-]+$/.test(arg)) {
    return arg;
  }

  return `"${String(arg).replaceAll('"', '\\"')}"`;
}
