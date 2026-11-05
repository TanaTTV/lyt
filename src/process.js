// Spawn helpers for yt-dlp and similar tools. Captures final output paths
// and per-item metadata from lyt markers while streaming progress lines to
// optional handlers.

import { spawn } from "node:child_process";
import process from "node:process";
import { errorLine } from "./failures.js";
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
    const errorLines = [];
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
        if (/^ERROR:/i.test(line.trim())) errorLines.push(line.trim());
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

      const diagnostic = [...new Set([...recent, ...errorLines])].join("\n");
      const reason = code === null ? `was stopped (${signal ?? "signal"})` : `exited with code ${code}`;
      // Lead with the tool's own ERROR line; keep the recent lines below it
      // for people, and the full tail in `diagnostic` for agents.
      const cause = errorLine(diagnostic);
      const detail = recent.length > 0 ? `\n${recent.join("\n")}` : "";
      const error = new Error(cause
        ? `${cause.replace(/^ERROR:\s*/i, "")}\n(${toolName(command)} ${reason})${detail}`
        : `${command} ${reason}${detail}`);
      error.exitCode = code ?? 1;
      error.signal = signal ?? null;
      error.diagnostic = diagnostic;
      if (code === null && signal) error.kind = "cancelled";
      reject(error);
    });
  });
}

function toolName(command) {
  return String(command).split(/[\\/]/).pop().replace(/\.exe$/i, "") || "tool";
}
