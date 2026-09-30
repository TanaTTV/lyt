import { resolve } from "node:path";
import { failureKind, FAILURE_KINDS } from "./failures.js";

export const RESULT_SCHEMA = "lyt.result.v1";
export const OUTPUT_MARKER = "__LYT_FILE__:";

export function outputCaptureArgs() {
  // --print implies quiet mode in yt-dlp; keep diagnostics so size guards
  // and other skips can be classified. The runner controls JSON output.
  return ["--print", `after_move:${OUTPUT_MARKER}%(filepath)s`, "--no-quiet"];
}
export function extractOutputPath(line, cwd = process.cwd()) {
  const clean = String(line).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").trim();

  if (!clean.startsWith(OUTPUT_MARKER)) {
    return null;
  }

  const value = clean.slice(OUTPUT_MARKER.length).trim();
  return value ? resolve(cwd, value) : null;
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
  const kind = failureKind(error);
  const [retryable, suggestion] = FAILURE_KINDS[kind];
  return {
    message: error instanceof Error ? error.message : String(error),
    code: Number.isInteger(error?.exitCode) ? error.exitCode : 1,
    kind,
    retryable,
    suggestion,
  };
}
