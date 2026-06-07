import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import {
  buildYtDlpArgs,
  formatCommand,
  normalizeOptions,
  parseArgs,
  usage,
} from "./ytDlp.js";
import { promptForJob } from "./interactive.js";
import { createProgressRenderer, parseProgressLine } from "./progress.js";
import { listFormats } from "./formats.js";
import { labelHeight } from "./quality.js";
import { ensureYtDlp, ensureFfmpeg } from "./bootstrap.js";

const VERSION = "0.5.0";

// Above this many URLs we skip the aggregated bar block (it would scroll the
// terminal) and fall back to yt-dlp's own inherited progress output.
const MAX_PROGRESS_BARS = 20;

export function run(argv, defaults = {}) {
  return main(argv, defaults).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = (error && error.exitCode) ?? 1;
  });
}

export async function main(argv, defaults = {}) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  if (parsed.version) {
    console.log(`lyt ${VERSION}`);
    return;
  }

  // Defaults set by the entry point (e.g. yt4 -> video). Explicit flags win.
  parsed.options = { ...defaults, ...parsed.options };

  const wantsInteractive =
    parsed.options.interactive ||
    (parsed.urls.length === 0 &&
      process.stdin.isTTY &&
      !parsed.options.dryRun &&
      !parsed.options.printCommand);

  const noDownload =
    parsed.options.noDownload ?? process.env.LYT_NO_DOWNLOAD === "1";

  if (wantsInteractive) {
    const fetchFormats = async (url) =>
      listFormats(url, {
        command: await ensureYtDlp({ noDownload }),
      });

    const job = await promptForJob({ defaults: parsed.options, fetchFormats });

    if (!job) {
      return;
    }

    parsed.urls = job.urls;
    parsed.options = { ...parsed.options, ...job.options };
  }

  const options = normalizeOptions(parsed.options);
  const urls = parsed.urls;

  if (urls.length === 0) {
    const error = new Error(`${usage()}\n\nMissing URL.`);
    error.exitCode = 2;
    throw error;
  }

  if (options.listFormats) {
    const command = await ensureYtDlp({ noDownload });

    for (const url of urls) {
      try {
        printFormats(url, await listFormats(url, { command }));
      } catch (error) {
        console.error(`- ${url}: ${error.message}`);
      }
    }

    return;
  }

  // Build each command exactly once and reuse it for both printing and running
  // so the printed command always matches what executes.
  const tasks = urls.map((url, index) => ({
    url,
    index,
    args: buildYtDlpArgs(url, options),
  }));

  if (options.printCommand || options.dryRun) {
    for (const task of tasks) {
      console.log(formatCommand("yt-dlp", task.args));
    }

    if (options.dryRun) {
      return;
    }
  }

  const ytDlpCommand = await ensureYtDlp({ noDownload });

  // ffmpeg is only needed for MP3 conversion, video muxing, or embedding.
  const needsFfmpeg =
    options.mp3 || options.video || options.embedMetadata || options.embedThumbnail;
  const ffmpegPath = needsFfmpeg
    ? await ensureFfmpeg({ noDownload })
    : null;

  // Tell yt-dlp where ffmpeg lives when it is not on PATH.
  if (ffmpegPath && ffmpegPath !== "ffmpeg") {
    for (const task of tasks) {
      task.args.splice(task.args.indexOf("--"), 0, "--ffmpeg-location", ffmpegPath);
    }
  }

  await mkdir(options.outputDir, { recursive: true });

  const jobs = Math.min(options.jobs, urls.length);
  const queue = [...tasks];
  const failures = [];

  // The aggregated progress block is only worth its complexity when several
  // downloads share one TTY. A single download keeps yt-dlp's native progress
  // (inherited stdio), which is already clean and battle-tested.
  const useRenderer =
    jobs > 1 &&
    process.stderr.isTTY &&
    !options.printCommand &&
    urls.length <= MAX_PROGRESS_BARS;
  const renderer = useRenderer
    ? createProgressRenderer(tasks.map((task) => shortLabel(task.url)))
    : null;

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      const lineHandler = renderer
        ? (line) => {
            const info = parseProgressLine(line);

            if (info) {
              renderer.update(task.index, info);
            }
          }
        : undefined;

      try {
        await runCommand(ytDlpCommand, task.args, { onLine: lineHandler });
        renderer?.done(task.index, true);
      } catch (error) {
        renderer?.done(task.index, false);
        failures.push({ url: task.url, error });
      }
    }
  }

  await Promise.all(Array.from({ length: jobs }, () => worker()));
  renderer?.finish();

  if (failures.length > 0) {
    const lines = failures.map(({ url, error }) => `- ${url}: ${error.message}`);
    const error = new Error(`Download failed:\n${lines.join("\n")}`);
    error.exitCode = 1;
    throw error;
  }
}


function runCommand(command, args, { onLine } = {}) {
  return new Promise((resolve, reject) => {
    if (!onLine) {
      const child = spawn(command, args, { stdio: "inherit" });

      child.on("error", reject);
      child.on("close", (code) => settle(resolve, reject, command, code));
      return;
    }

    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const recent = [];
    let buffer = "";

    const feed = (chunk) => {
      buffer += chunk;
      let newline;

      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        onLine(line);

        // Keep a few non-progress lines so a failure can show why.
        if (line.trim() && !line.startsWith("[download]")) {
          recent.push(line);

          if (recent.length > 8) {
            recent.shift();
          }
        }
      }
    };

    child.stdout.setEncoding("utf8").on("data", feed);
    child.stderr.setEncoding("utf8").on("data", feed);
    child.on("error", reject);
    child.on("close", (code) => settle(resolve, reject, command, code, recent));
  });
}

function settle(resolve, reject, command, code, recent = []) {
  if (code === 0) {
    resolve();
    return;
  }

  const detail = recent.length > 0 ? `\n${recent.join("\n")}` : "";
  const error = new Error(`${command} exited with code ${code}${detail}`);
  error.exitCode = code;
  reject(error);
}

function printFormats(url, formats) {
  console.log(formats.title ? `${formats.title}` : url);

  if (formats.heights.length > 0) {
    const labels = formats.heights.map((height) => labelHeight(height));
    console.log(`  video: ${labels.join(", ")}`);
    const best = formats.heights[0];
    console.log(`  download best with: yt4 -q ${best}p -- "${url}"`);
  }

  if (formats.audioBitrates.length > 0) {
    console.log(`  audio: ${formats.audioBitrates.map((rate) => `${rate}k`).join(", ")}`);
  }

  if (formats.heights.length === 0 && formats.audioBitrates.length === 0) {
    console.log("  no downloadable formats reported");
  }

  console.log("");
}

function shortLabel(url) {
  const id = /[?&]v=([\w-]{6,})/.exec(url)?.[1] ?? /([\w-]{6,})$/.exec(url)?.[1];
  return id ?? url;
}

export function outputTemplate(outputDir, template) {
  return join(outputDir, template);
}

export function outputParent(outputPath) {
  return dirname(outputPath);
}
