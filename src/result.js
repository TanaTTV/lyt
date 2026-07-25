import { resolve } from "node:path";

export const RESULT_SCHEMA = "lyt.result.v1";
export const OUTPUT_MARKER = "__LYT_FILE__:";
export const SUBTITLE_MARKER = "__LYT_SUBTITLES__:";

export function outputCaptureArgs() {
  return ["--print", `after_move:${OUTPUT_MARKER}%(filepath)s`];
}

export function subtitleCaptureArgs() {
  return ["--print", `after_move:${SUBTITLE_MARKER}%(requested_subtitles)j`];
}

export function extractOutputPath(line, cwd = process.cwd()) {
  const clean = String(line).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").trim();

  if (!clean.startsWith(OUTPUT_MARKER)) {
    return null;
  }

  const value = clean.slice(OUTPUT_MARKER.length).trim();
  return value ? resolve(cwd, value) : null;
}

export function extractSubtitlePaths(line, cwd = process.cwd()) {
  const clean = String(line).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").trim();
  if (!clean.startsWith(SUBTITLE_MARKER)) return null;

  try {
    const payload = JSON.parse(clean.slice(SUBTITLE_MARKER.length).trim());
    return Object.values(payload ?? {})
      .map((track) => track?.filepath)
      .filter((file) => typeof file === "string" && file.trim())
      .map((file) => resolve(cwd, file));
  } catch {
    return [];
  }
}

export function resultEnvelope({ command, ok, results = [], error = null, version }) {
  return {
    schema: RESULT_SCHEMA,
    version,
    command,
    ok,
    results,
    ...(error ? { error } : {}),
  };
}

export function errorDetails(error) {
  return {
    message: error instanceof Error ? error.message : String(error),
    code: Number.isInteger(error?.exitCode) ? error.exitCode : 1,
  };
}
