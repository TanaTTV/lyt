// Spawn helpers for yt-dlp and similar tools. Captures final output paths
// and per-item metadata from lyt markers while streaming progress lines to
// optional handlers.

import { spawn } from "node:child_process";
import process from "node:process";
import { extractOutputMeta, extractOutputPath } from "./result.js";

// yt-dlp exits with 101 when --max-downloads stops it on purpose.
export const MAX_DOWNLOADS_REACHED = 101;

export function runCommand(command, args, {
  onLine,
  quiet = false,
  cwd = process.cwd(),
  spawnFn = spawn,
  okCodes = [0],
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const recent = [];
    const files = [];
    const items = [];
    let sizeLimited = false;
    const buffers = { stdout: "", stderr: "" };

    const feed = (stream, chunk) => {
      buffers[stream] += chunk;
      let newline;

      while ((newline = buffers[stream].indexOf("\n")) >= 0) {
        const line = buffers[stream].slice(0, newline).replace(/\r$/, "");
        buffers[stream] = buffers[stream].slice(newline + 1);
        handleLine(stream, line);
      }
    };

    const handleLine = (stream, line) => {
      if (/larger than max-filesize/i.test(line)) sizeLimited = true;
      const outputPath = extractOutputPath(line, cwd);

      if (outputPath) {
        if (!files.includes(outputPath)) files.push(outputPath);
        return;
      }

      const meta = extractOutputMeta(line);
      if (meta) {
        items.push(meta);
        return;
      }

      onLine?.(line);

      if (!quiet && !onLine) {
        const writer = stream === "stdout" ? process.stdout : process.stderr;
        writer.write(`${line}\n`);
      }

      // Keep a few non-progress lines so a failure can show why.
      if (line.trim() && !line.startsWith("[download]")) {
        recent.push(line);
        if (recent.length > 8) recent.shift();
      }
    };

    child.stdout.setEncoding("utf8").on("data", (chunk) => feed("stdout", chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => feed("stderr", chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      for (const stream of ["stdout", "stderr"]) {
        if (buffers[stream]) handleLine(stream, buffers[stream].replace(/\r$/, ""));
      }

      if (okCodes.includes(code)) {
        resolve({ files, items, sizeLimited });
        return;
      }

      const detail = recent.length > 0 ? `\n${recent.join("\n")}` : "";
      const reason = code === null ? `was stopped (${signal ?? "signal"})` : `exited with code ${code}`;
      const error = new Error(`${command} ${reason}${detail}`);
      error.exitCode = code ?? 1;
      error.signal = signal ?? null;
      reject(error);
    });
  });
}
