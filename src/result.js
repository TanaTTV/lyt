import { resolve } from "node:path";

export const RESULT_SCHEMA = "lyt.result.v1";
export const OUTPUT_MARKER = "__LYT_FILE__:";
export const META_MARKER = "__LYT_META__:";

// Two after-move prints per finished item: the exact final path, and a small
// JSON description (ID, title, site, page URL) used for history and results.
export function outputCaptureArgs() {
  return [
    "--print",
    `after_move:${OUTPUT_MARKER}%(filepath)s`,
    "--print",
    `after_move:${META_MARKER}%(.{id,title,extractor_key,webpage_url,duration,uploader})j`,
  ];
}

// Parses a META_MARKER line into { id, title, extractor, webpageUrl,
// durationSeconds, uploader }, or returns null for any other line.
export function extractOutputMeta(line) {
  const clean = stripAnsi(line).trim();
  if (!clean.startsWith(META_MARKER)) return null;

  let raw;
  try {
    raw = JSON.parse(clean.slice(META_MARKER.length));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const text = (value) => (typeof value === "string" && value.trim() !== "" ? value : null);
  return {
    id: text(raw.id),
    title: text(raw.title),
    extractor: text(raw.extractor_key),
    webpageUrl: text(raw.webpage_url),
    durationSeconds: Number.isFinite(raw.duration) ? raw.duration : null,
    uploader: text(raw.uploader),
  };
}

function stripAnsi(line) {
  return String(line).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

// `cwd` is the base for resolving relative paths that yt-dlp prints; it is
// the directory yt-dlp was started in.
export function extractOutputPath(line, cwd = process.cwd()) {
  const clean = stripAnsi(line).trim();

  if (!clean.startsWith(OUTPUT_MARKER)) {
    return null;
  }

  const value = clean.slice(OUTPUT_MARKER.length).trim();
  return value ? resolve(cwd, value) : null;
}

export function resultEnvelope({ command, ok, results = [], error = null, warnings = [], version }) {
  return {
    schema: RESULT_SCHEMA,
    version,
    command,
    ok,
    results,
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(error ? { error } : {}),
  };
}

export function errorDetails(error) {
  return {
    message: error instanceof Error ? error.message : String(error),
    code: Number.isInteger(error?.exitCode) ? error.exitCode : 1,
  };
}
