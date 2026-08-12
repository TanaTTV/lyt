// Spawn helpers for yt-dlp and similar tools. Captures final output paths
// from lyt markers while streaming progress lines to optional handlers.

import { spawn } from "node:child_process";
import process from "node:process";
import { extractOutputPath } from "./result.js";

export function runCommand(command, args, { onLine, quiet = false, cwd = process.cwd() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const recent = [];
    const files = [];
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
      const outputPath = extractOutputPath(line, cwd);

      if (outputPath) {
        if (!files.includes(outputPath)) files.push(outputPath);
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
    child.on("close", (code) => {
      for (const stream of ["stdout", "stderr"]) {
        if (buffers[stream]) handleLine(stream, buffers[stream].replace(/\r$/, ""));
      }
      settle(resolve, reject, command, code, recent, { files });
    });
  });
}

function settle(resolve, reject, command, code, recent = [], outcome = { files: [] }) {
  if (code === 0) {
    resolve(outcome);
    return;
  }

  const detail = recent.length > 0 ? `\n${recent.join("\n")}` : "";
  const error = new Error(`${command} exited with code ${code}${detail}`);
  error.exitCode = code;
  reject(error);
}
