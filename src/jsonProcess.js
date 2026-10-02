// Metadata requests must finish or fail within a bounded time and output size.
import { spawn } from "node:child_process";

export function runJsonTool(command, args, {
  spawnFn = spawn,
  timeoutMs = 60_000,
  maxBytes = 16 * 1024 * 1024,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, {
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let settled = false;
    let timer;
    const finish = (error, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(payload);
    };
    const stop = (message) => {
      finish(new Error(message));
      try { child.kill("SIGKILL"); } catch { /* The process may already have exited. */ }
    };
    timer = setTimeout(() => stop(`Tool request timed out after ${timeoutMs}ms.`), timeoutMs);
    const capture = (stream, chunk) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > maxBytes) {
        stop("Tool output exceeded the permitted size.");
        return;
      }
      if (stream === "stdout") stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.setEncoding("utf8").on("data", (chunk) => capture("stdout", chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => capture("stderr", chunk));
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const error = new Error(stderr.trim() || `Tool exited with code ${code}.`);
        error.exitCode = code ?? 1;
        finish(error);
        return;
      }
      try { finish(null, JSON.parse(stdout)); }
      catch { finish(new Error("Could not parse tool JSON output.")); }
    });
  });
}
