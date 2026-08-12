// Shared CLI error helpers. Keep exit codes stable for agents and scripts.

import process from "node:process";
import { errorDetails, resultEnvelope } from "./result.js";
import { VERSION } from "./version.js";

/** User/usage error (invalid flags, missing args). Exit code 2. */
export function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

/**
 * Top-level CLI catch: JSON error envelope when --json, else stderr.
 * Honors error.jsonPrinted so download failures can emit once.
 */
export function handleCliError(error, { json = false } = {}) {
  if (json && !error?.jsonPrinted) {
    console.log(JSON.stringify(resultEnvelope({
      command: "error",
      ok: false,
      error: errorDetails(error),
      version: VERSION,
    })));
  } else if (!json) {
    console.error(error instanceof Error ? error.message : String(error));
  } else if (json && error?.jsonPrinted) {
    // Result already printed; keep exit code only.
  }

  process.exitCode = error?.exitCode ?? 1;
}
