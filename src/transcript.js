// Transcripts from a video's subtitles or automatic captions, as clean text
// with timestamps. Nothing but the caption file is downloaded.

import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errorLine, taggedError } from "./failures.js";
import { ytDlpJsRuntimeArgs } from "./jsRuntime.js";
import { runJsonTool } from "./jsonProcess.js";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function vttSeconds(stamp) {
  const parts = stamp.trim().replace(",", ".").split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

// Parses WebVTT into segments. YouTube's automatic captions "roll": each cue
// repeats the previous line before adding a new one, so a line already
// emitted in the last few cues is dropped.
export function parseVtt(text) {
  const segments = [];
  const recent = [];
  const blocks = String(text).replace(/\r/g, "").split(/\n{2,}/);

  let cue = null;
  for (const block of blocks) {
    const lines = block.split("\n");
    const timing = lines.findIndex((line) => line.includes("-->"));
    const match = timing < 0 ? null : /^\s*([\d:.,]+)\s+-->\s+([\d:.,]+)/.exec(lines[timing]);
    let text;
    if (match) {
      cue = { start: vttSeconds(match[1]), end: vttSeconds(match[2]) };
      text = lines.slice(timing + 1);
    } else if (cue && !/^(?:NOTE|STYLE|REGION)\b/.test(lines[0] ?? "")) {
      // Some files leave a blank line between a cue's timing and its text.
      text = lines;
    } else {
      continue;
    }
    const { start, end } = cue;

    for (const raw of text) {
      const line = decodeEntities(raw.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
      if (line === "" || recent.includes(line)) continue;
      segments.push({ start: round(start), end: round(end), text: line });
      recent.push(line);
      if (recent.length > 3) recent.shift();
    }
  }

  return segments;
}

function round(seconds) {
  return Math.round(seconds * 1000) / 1000;
}

// Plain text in paragraphs; a pause of 3s or more starts a new paragraph.
export function transcriptText(segments) {
  const paragraphs = [];
  let current = [];
  let lastEnd = null;
  for (const segment of segments) {
    if (lastEnd != null && segment.start - lastEnd >= 3 && current.length > 0) {
      paragraphs.push(current.join(" "));
      current = [];
    }
    current.push(segment.text);
    lastEnd = Math.max(lastEnd ?? 0, segment.end);
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs.join("\n\n");
}

export function formatTimestamp(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// Which language was written, and whether it came from automatic captions.
function pickWritten(media, files) {
  const requested = media.requested_subtitles ?? {};
  for (const [language, entry] of Object.entries(requested)) {
    const file = entry?.filepath && files.includes(entry.filepath) && /\.(?:vtt|srt)$/.test(entry.filepath) ? entry.filepath : null;
    const fallback = files.find((candidate) => new RegExp(`\\.${language.replace(/[^\w-]/g, "")}\\.(?:vtt|srt)$`).test(candidate));
    if (file || fallback) {
      return {
        language,
        automatic: !Object.hasOwn(media.subtitles ?? {}, language),
        file: file ?? fallback,
      };
    }
  }
  const any = files.find((candidate) => /\.(?:vtt|srt)$/.test(candidate));
  if (!any) return null;
  const language = /\.([^.]+)\.(?:vtt|srt)$/.exec(any)?.[1] ?? null;
  return { language, automatic: !Object.hasOwn(media.subtitles ?? {}, language), file: any };
}

function availableLanguages(media) {
  const manual = Object.keys(media.subtitles ?? {}).filter((key) => key !== "live_chat");
  const original = Object.keys(media.automatic_captions ?? {}).filter((key) => key.endsWith("-orig"));
  return [...new Set([...manual, ...original.map((key) => key.replace(/-orig$/, ""))])];
}

export async function fetchTranscript(url, {
  command = "yt-dlp",
  language = "en",
  spawnFn = spawn,
  runtimeArgs = ytDlpJsRuntimeArgs(),
  timeoutMs = 120_000,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "lyt-transcript-"));
  try {
    let media;
    try {
      media = await runJsonTool(command, [
        "-J", "--no-simulate", "--skip-download", "--no-warnings", ...runtimeArgs,
        "--write-subs", "--write-auto-subs", "--sub-langs", `${language},${language}-orig`,
        // VTT or SRT both parse here; no ffmpeg conversion step is needed.
        "--sub-format", "vtt/srt/best",
        "--no-playlist", "-o", join(dir, "t.%(ext)s"), "--", url,
      ], { spawnFn, timeoutMs });
    } catch (cause) {
      const line = errorLine(cause.diagnostic ?? cause.message);
      const reason = line ? line.replace(/^ERROR:\s*/i, "") : cause.message;
      const error = new Error(`yt-dlp could not read captions for ${url}\n${reason}`, { cause });
      error.exitCode = cause.exitCode ?? 1;
      if (cause.code) error.code = cause.code;
      if (cause.kind) error.kind = cause.kind;
      error.diagnostic = cause.diagnostic ?? cause.message;
      throw error;
    }

    const files = readdirSync(dir).map((name) => join(dir, name));
    const written = pickWritten(media, files);
    if (!written) {
      const others = availableLanguages(media);
      throw taggedError(
        `No "${language}" subtitles or automatic captions for ${url}.` +
          (others.length > 0 ? ` Available: ${others.join(", ")} (use --lang).` : ""),
        "no_output",
      );
    }

    const segments = parseVtt(readFileSync(written.file, "utf8"));
    return {
      url,
      id: media.id ?? null,
      title: media.title ?? null,
      uploader: media.uploader ?? media.channel ?? null,
      durationSeconds: Number.isFinite(media.duration) ? Math.round(media.duration) : null,
      language: written.language,
      automatic: written.automatic,
      chapters: (media.chapters ?? [])
        .filter((chapter) => Number.isFinite(chapter?.start_time))
        .map((chapter) => ({
          start: chapter.start_time,
          end: Number.isFinite(chapter.end_time) ? chapter.end_time : null,
          title: String(chapter.title ?? ""),
        })),
      segments,
      text: transcriptText(segments),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
