// `lyt capabilities`: a static, deterministic description of the product
// surface so autonomous agents can discover commands, modes, flags, and result
// schemas without scraping human `--help` text. Environment/tool readiness is a
// separate concern answered by `lyt doctor --json`.

import process from "node:process";
import { profileNames } from "./config.js";
import { FAILURE_KINDS } from "./failures.js";
import { VERSION } from "./version.js";

export const COMMANDS = [
  "download",
  "info",
  "inspect",
  "search",
  "transcript",
  "capabilities",
  "doctor",
  "history",
  "last",
  "config",
  "agent",
  "completion",
  "mcp",
  "update",
];

export const MODES = ["audio", "video", "mp3", "native"];

export const SCHEMAS = [
  "lyt.result.v1",
  "lyt.doctor.v1",
  "lyt.history.v1",
  "lyt.info.v1",
  "lyt.capabilities.v1",
  "lyt.search.v1",
  "lyt.transcript.v1",
];

export const EXIT_CODES = {
  0: "success",
  1: "runtime or download failure",
  2: "usage or validation error",
  127: "required tool unavailable or setup failed",
};

// Machine-readable description of the download flags an agent can pass.
// `takesValue` tells the agent whether the flag consumes the next argument.
// A drift guard test (test/capabilities.test.js) asserts every flag here is
// recognized by the argument parser.
export const OPTIONS = [
  { flag: "--audio", takesValue: false, summary: "Download audio only (default)." },
  { flag: "--video", takesValue: false, summary: "Download video muxed to mp4." },
  { flag: "--mp3", takesValue: false, summary: "Convert extracted audio to MP3." },
  { flag: "--native", takesValue: false, summary: "Keep the native audio stream." },
  { flag: "--quality", takesValue: true, summary: "MP3 bitrate or video resolution." },
  { flag: "--max-height", takesValue: true, summary: "Cap video resolution." },
  { flag: "--max-filesize", takesValue: true, summary: "Skip media larger than this size." },
  { flag: "--output-dir", takesValue: true, summary: "Destination directory." },
  { flag: "--jobs", takesValue: true, summary: "Parallel downloads across URLs; info supports 1-16 workers." },
  { flag: "--fragments", takesValue: true, summary: "Concurrent fragments per download." },
  { flag: "--list-formats", takesValue: false, summary: "List available qualities without downloading." },
  { flag: "--clip", takesValue: true, summary: "Download one section; repeatable." },
  { flag: "--split-chapters", takesValue: false, summary: "One file per chapter." },
  { flag: "--normalize", takesValue: false, summary: "EBU R128 loudness normalization (implies MP3)." },
  { flag: "--profile", takesValue: true, summary: "Preset bundle: music, podcast, voice, or edit (H.264 MP4 for video editors)." },
  { flag: "--no-normalize", takesValue: false, summary: "Disable normalization inherited from config/profile." },
  { flag: "--playlist", takesValue: false, summary: "Allow playlist downloads (opt-in)." },
  { flag: "--no-playlist", takesValue: false, summary: "Download only the single video (default)." },
  { flag: "--no-part", takesValue: false, summary: "Write directly to the output file (skip .part)." },
  { flag: "--force-overwrite", takesValue: false, summary: "Replace existing files (opt-in)." },
  { flag: "--redownload", takesValue: false, summary: "Bypass history dedupe (opt-in)." },
  { flag: "--no-history", takesValue: false, summary: "Do not read or write history." },
  { flag: "--embed-metadata", takesValue: false, summary: "Embed media metadata." },
  { flag: "--embed-thumbnail", takesValue: false, summary: "Embed the thumbnail." },
  { flag: "--template", takesValue: true, summary: "Custom yt-dlp output template." },
  { flag: "--downloader", takesValue: true, summary: "External downloader such as aria2c (opt-in)." },
  { flag: "--downloader-args", takesValue: true, summary: "Arguments for the external downloader." },
  { flag: "--no-download", takesValue: false, summary: "Require tools on PATH; skip managed install." },
  { flag: "--subs", takesValue: false, summary: "Save subtitles (manual or automatic) as .srt files." },
  { flag: "--sub-langs", takesValue: true, summary: "Subtitle languages, e.g. en or \"en.*,de\" (implies --subs)." },
  { flag: "--embed-subs", takesValue: false, summary: "Embed subtitles in the video (video mode)." },
  { flag: "--no-subs", takesValue: false, summary: "Disable subtitles inherited from config." },
  { flag: "--sponsorblock", takesValue: false, summary: "Cut sponsor, self-promo, and interaction segments (opt-in)." },
  { flag: "--no-sponsorblock", takesValue: false, summary: "Disable SponsorBlock inherited from config." },
  { flag: "--cookies-from-browser", takesValue: true, summary: "Use the user's browser cookies (authentication material; opt-in)." },
  { flag: "--cookies", takesValue: true, summary: "Use a Netscape cookies file (authentication material; opt-in)." },
  { flag: "--limit-rate", takesValue: true, summary: "Cap download speed, e.g. 2M." },
  { flag: "--retries", takesValue: true, summary: "Retry count for downloads and fragments (0-100)." },
  { flag: "--batch-file", takesValue: true, summary: "Read URLs from a file, one per line (- for stdin)." },
  { flag: "--sync", takesValue: false, summary: "Spotify: renumber saved songs and move removed ones aside." },
  { flag: "--history", takesValue: false, summary: "Re-enable history when config disables it." },
  { flag: "--print-command", takesValue: false, summary: "Print an inert yt-dlp argv preview before running." },
  { flag: "--dry-run", takesValue: false, summary: "Plan the job without downloading or installing." },
  { flag: "--json", takesValue: false, summary: "Emit one versioned JSON document on stdout." },
  { flag: "--editor", takesValue: false, summary: "Editor-friendly video: prefer H.264 + AAC in MP4 (implies --video; alias --h264)." },
  { flag: "--audio-format", takesValue: true, summary: "Audio output: native, mp3, m4a, opus, wav, or flac." },
  { flag: "--container", takesValue: true, summary: "Video container: mp4 (default), mkv, or mov." },
  { flag: "--name", takesValue: true, summary: "Output file name without extension (single URL only)." },
  { flag: "--chapter", takesValue: true, summary: "Download only chapters whose title contains this text; repeatable." },
  { flag: "--thumbnail", takesValue: false, summary: "Save the thumbnail as a .jpg next to the media." },
  { flag: "--info-json", takesValue: false, summary: "Save yt-dlp's .info.json metadata next to the media." },
  { flag: "--items", takesValue: true, summary: "Playlist positions to fetch, e.g. 1-5,8 or 10-." },
  { flag: "--max-items", takesValue: true, summary: "Stop after this many playlist entries." },
  { flag: "--after", takesValue: true, summary: "Only media uploaded on or after a date (2026-01-31 or today-7days)." },
  { flag: "--before", takesValue: true, summary: "Only media uploaded on or before a date." },
  { flag: "--min-duration", takesValue: true, summary: "Skip media shorter than this (seconds or 1:30)." },
  { flag: "--max-duration", takesValue: true, summary: "Skip media longer than this (seconds or 1:30)." },
  { flag: "--wait", takesValue: false, summary: "Wait for a premiere or scheduled live stream to start." },
  { flag: "--polite", takesValue: false, summary: "Pause between requests to avoid rate limits on big jobs." },
];

// Options for subcommands other than download.
export const COMMAND_OPTIONS = {
  search: [
    { flag: "--limit", takesValue: true, summary: "Return 1-25 candidates (default 5)." },
    { flag: "--json", takesValue: false, summary: "Emit lyt.search.v1." },
    { flag: "--no-download", takesValue: false, summary: "Prevent managed tool provisioning." },
  ],
  transcript: [
    { flag: "--lang", takesValue: true, summary: "Caption language code (default en)." },
    { flag: "--timestamps", takesValue: false, summary: "Human output with [m:ss] before each line." },
    { flag: "--json", takesValue: false, summary: "Emit lyt.transcript.v1 with segments and chapters." },
    { flag: "--no-download", takesValue: false, summary: "Prevent managed tool provisioning." },
  ],
  last: [
    { flag: "--json", takesValue: false, summary: "Emit lyt.history.v1 with the newest entry whose files exist." },
    { flag: "--open", takesValue: false, summary: "Open the file with the default app." },
    { flag: "--reveal", takesValue: false, summary: "Show the file in its folder." },
  ],
  completion: [],
  mcp: [],
};

export function buildCapabilities() {
  return {
    schema: "lyt.capabilities.v1",
    version: VERSION,
    command: "capabilities",
    ok: true,
    node: process.versions.node,
    commands: COMMANDS,
    modes: MODES,
    profiles: profileNames(),
    schemas: SCHEMAS,
    exitCodes: EXIT_CODES,
    options: OPTIONS,
    commandOptions: COMMAND_OPTIONS,
    errorKinds: Object.entries(FAILURE_KINDS)
      .map(([kind, [retryable, suggestion]]) => ({ kind, retryable, suggestion })),
  };
}
