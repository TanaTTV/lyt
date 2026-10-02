// `lyt capabilities`: a static, deterministic description of the product
// surface so autonomous agents can discover commands, modes, flags, and result
// schemas without scraping human `--help` text. Environment/tool readiness is a
// separate concern answered by `lyt doctor --json`.

import process from "node:process";
import { profileNames } from "./config.js";
import { VERSION } from "./version.js";

export const COMMANDS = [
  "download",
  "info",
  "inspect",
  "capabilities",
  "doctor",
  "history",
  "config",
  "agent",
];

export const MODES = ["audio", "video", "mp3", "native"];

export const SCHEMAS = [
  "lyt.result.v1",
  "lyt.doctor.v1",
  "lyt.history.v1",
  "lyt.info.v1",
  "lyt.capabilities.v1",
];

export const EXIT_CODES = {
  0: "success",
  1: "runtime or download failure",
  2: "usage or validation error",
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
  { flag: "--profile", takesValue: true, summary: "Preset bundle: music, podcast, or voice." },
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
];

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
  };
}
