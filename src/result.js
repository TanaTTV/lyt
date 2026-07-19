import { resolve } from "node:path";

export const RESULT_SCHEMA = "lyt.result.v1";
export const OUTPUT_MARKER = "__LYT_FILE__:";

export function outputCaptureArgs() {
  return ["--print", `after_move:${OUTPUT_MARKER}%(filepath)s`];
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
  return {
    message: error instanceof Error ? error.message : String(error),
    code: Number.isInteger(error?.exitCode) ? error.exitCode : 1,
  };
}
