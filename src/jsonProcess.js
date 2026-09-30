// Bounded JSON tool execution; no shell, no download-specific side effects.
import { spawn } from "node:child_process";
import { taggedError } from "./failures.js";

export function runJsonTool(command, args, {
  spawnFn = spawn, timeoutMs = 60_000, maxBytes = 16 * 1024 * 1024,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let settled = false;
    const finish = (error, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(payload);
    };
    const stop = (error) => {
      finish(error);
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => stop(taggedError(
      `Tool request timed out after ${timeoutMs}ms.`, "network",
    )), timeoutMs);
    const capture = (stream, chunk) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > maxBytes) {
        stop(taggedError("Tool output exceeded the permitted size.", "tool_output_invalid"));
        return;
      }
      if (stream === "stdout") stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.setEncoding("utf8").on("data", (chunk) => capture("stdout", chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => capture("stderr", chunk));
    child.on("error", (error) => finish(error));
    child.on("close", (code, signal) => {
      if (settled) return;
      if (code !== 0) {
        const error = new Error(stderr.trim() || `Tool exited with code ${code}.`);
        error.exitCode = code ?? 1;
        error.diagnostic = stderr.trim();
        if (signal) error.kind = "cancelled";
        finish(error);
        return;
      }
      try { finish(null, JSON.parse(stdout)); }
      catch { finish(taggedError("Could not parse tool JSON output.", "tool_output_invalid")); }
    });
  });
}
