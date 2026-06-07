import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
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
import { ensureFfmpeg, ensureYtDlp } from "./bootstrap.js";

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

  if (wantsInteractive) {
    const command = await resolveYtDlp(parsed.options);
    const fetchFormats = (url) => listFormats(url, { command });

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
    const command = await resolveYtDlp(options);

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

  // Dry-run is a pure preview: print the base command and exit without
  // resolving (or downloading) any binaries.
  if (options.dryRun) {
    for (const task of tasks) {
      console.log(formatCommand("yt-dlp", task.args));
    }

    return;
  }

  const ytDlpCommand = await resolveYtDlp(options);

  // ffmpeg is needed both for MP3 extraction and for muxing separate
  // video+audio streams into the final mp4. Provision it for either.
  let ffmpegCommand = null;

  if (options.mp3 || options.video) {
    ffmpegCommand = await resolveFfmpeg(options);
  }

  // Point yt-dlp at our managed ffmpeg when it isn't the one on PATH, baking it
  // into the args before printing so the printed command matches what runs.
  if (ffmpegCommand && ffmpegCommand !== "ffmpeg") {
    for (const task of tasks) {
      task.args = ["--ffmpeg-location", ffmpegCommand, ...task.args];
    }
  }

  if (options.printCommand) {
    for (const task of tasks) {
      console.log(formatCommand("yt-dlp", task.args));
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

// Find a working binary on PATH (plus the Windows fallback locations), or null
// if it isn't installed. A single `--version` probe keeps the happy path cheap.
function probeOnPath(command) {
  let executable = command;
  let probe = spawnSync(executable, ["--version"], { encoding: "utf8" });

  if (probe.error?.code === "ENOENT" && process.platform === "win32") {
    const fallback = resolveWindowsCommand(command);

    if (fallback) {
      executable = fallback;
      probe = spawnSync(executable, ["--version"], { encoding: "utf8" });
    }
  }

  return probe.error?.code === "ENOENT" ? null : executable;
}

async function resolveYtDlp(options) {
  const executable = await ensureYtDlp({
    onPath: probeOnPath("yt-dlp"),
    allowDownload: options.download,
    log: (message) => console.error(message),
  });

  if (!executable) {
    const error = new Error(
      "yt-dlp was not found and auto-download is disabled.\n" +
        "Install it (https://github.com/yt-dlp/yt-dlp#installation) or remove --no-download.",
    );
    error.exitCode = 127;
    throw error;
  }

  return executable;
}

async function resolveFfmpeg(options) {
  const executable = await ensureFfmpeg({
    onPath: probeOnPath("ffmpeg"),
    allowDownload: options.download,
    log: (message) => console.error(message),
  });

  if (!executable) {
    const error = new Error(
      "ffmpeg was not found and auto-download is disabled.\n" +
        "Install ffmpeg and make sure it is on PATH, or remove --no-download.",
    );
    error.exitCode = 127;
    throw error;
  }

  return executable;
}

function resolveWindowsCommand(command) {
  const executable = `${command}.exe`;
  const knownPaths = [
    join("C:\\", "ffmpeg", "bin", executable),
    findWinGetExecutable(command, executable),
  ].filter(Boolean);

  return knownPaths.find((candidate) => existsSync(candidate)) ?? null;
}

function findWinGetExecutable(command, executable) {
  const localAppData = process.env.LOCALAPPDATA;

  if (!localAppData) {
    return null;
  }

  const packagesDir = join(localAppData, "Microsoft", "WinGet", "Packages");

  if (!existsSync(packagesDir)) {
    return null;
  }

  try {
    const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name.toLowerCase().startsWith(`${command.toLowerCase()}.`))
      .sort();

    for (const dir of packageDirs) {
      const direct = join(packagesDir, dir, executable);

      if (existsSync(direct)) {
        return direct;
      }

      // WinGet often nests the binary inside a versioned subfolder.
      for (const entry of readdirSync(join(packagesDir, dir), { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const nested = join(packagesDir, dir, entry.name, executable);

          if (existsSync(nested)) {
            return nested;
          }
        }
      }
    }

    return null;
  } catch {
    return null;
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
