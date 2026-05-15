import { join } from "node:path";

const DEFAULT_OUTPUT_TEMPLATE = "%(title).180B [%(id)s].%(ext)s";

export function parseArgs(argv) {
  const options = {};
  const urls = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      return { help: true, options, urls };
    }

    if (arg === "-v" || arg === "--version") {
      return { version: true, options, urls };
    }

    if (arg === "--mp3") {
      options.mp3 = true;
      continue;
    }

    if (arg === "--native") {
      options.mp3 = false;
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

    if (arg.startsWith("-")) {
      const error = new Error(`Unknown option: ${arg}`);
      error.exitCode = 2;
      throw error;
    }

    urls.push(arg);
  }

  return { options, urls };
}

export function normalizeOptions(options = {}) {
  return {
    mp3: options.mp3 ?? false,
    outputDir: options.outputDir ?? "downloads",
    quality: normalizeQuality(options.quality ?? "192K"),
    fragments: normalizePositiveInteger(options.fragments ?? 8, "fragments"),
    jobs: normalizePositiveInteger(options.jobs ?? 1, "jobs"),
    playlist: options.playlist ?? false,
    dryRun: options.dryRun ?? false,
    printCommand: options.printCommand ?? false,
    embedMetadata: options.embedMetadata ?? false,
    embedThumbnail: options.embedThumbnail ?? false,
    continueDownloads: options.continueDownloads ?? true,
    forceOverwrite: options.forceOverwrite ?? false,
    template: options.template ?? DEFAULT_OUTPUT_TEMPLATE,
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
    options.mp3 ? "bestaudio" : "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
    "-o",
    join(options.outputDir, options.template),
  ];

  if (!options.playlist) {
    args.push("--no-playlist");
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

  args.push(url);
  return args;
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

Options:
  --mp3                  Convert extracted audio to MP3 with ffmpeg
  --native               Save native audio stream when possible (default)
  -q, --quality <value>  MP3 quality, e.g. 128K, 192K, 320K, or 0 (default: 192K)
  -f, --fragments <n>    Concurrent fragments per download (default: 8)
  -j, --jobs <n>         Parallel downloads for multiple URLs (default: 1)
  -o, --output-dir <dir> Output directory (default: downloads)
  --template <template>  yt-dlp output template
  --playlist             Allow playlist downloads
  --no-playlist          Download only the single video URL (default)
  --embed-metadata       Embed metadata; may add time
  --embed-thumbnail      Embed thumbnail; may add time
  --force-overwrite      Replace existing files
  --print-command        Print yt-dlp commands before running
  --dry-run              Print commands without running
  -h, --help             Show this help
  -v, --version          Show version`;
}

function readValue(argv, index, optionName) {
  const value = argv[index];

  if (!value || value.startsWith("-")) {
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
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
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
