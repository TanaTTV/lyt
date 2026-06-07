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
import { labelHeight } from "./quality.js";

const VERSION = "0.5.0";

// Above this many URLs we skip the aggregated bar block (it would scroll the
// terminal) and fall back to yt-dlp's own inherited progress output.
const MAX_PROGRESS_BARS = 20;

// Cache spawnSync("--version") probes so ensureCommand never forks twice for
// the same binary. Interactive mode calls it once inside the fetchFormats
// closure and then again in the main download path.
const commandCache = new Map();

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
    // Lazy-load: readline/promises is non-trivial and only needed in
    // interactive mode. Importing it on every cold start (the common case of
    // `lyt URL`) would cost 10-30 ms for no reason.
    const [{ promptForJob }, { listFormats }] = await Promise.all([
      import("./interactive.js"),
      import("./formats.js"),
    ]);

    const fetchFormats = (url) =>
      listFormats(url, {
        command: ensureCommand(
          "yt-dlp",
          "Install yt-dlp first: https://github.com/yt-dlp/yt-dlp#installation",
        ),
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
    // Lazy-load: not needed for normal downloads.
    const { listFormats } = await import("./formats.js");
    const command = ensureCommand(
      "yt-dlp",
      "Install yt-dlp first: https://github.com/yt-dlp/yt-dlp#installation",
    );

    for (const url of urls) {
      try {
        printFormats(url, await listFormats(url, { command }));
      } catch (error) {
        console.error(`- ${url}: ${error.message}`);
      }
    }

    return;
  }

  // Compute concurrency and renderer eligibility before building args so we
  // can pass the flag to buildYtDlpArgs and include --newline only when the
  // progress line parser actually needs it.
  const jobs = Math.min(options.jobs, urls.length);
  const useRenderer =
    jobs > 1 &&
    process.stderr.isTTY &&
    !options.printCommand &&
    urls.length <= MAX_PROGRESS_BARS;

  // Build each command exactly once and reuse it for both printing and running
  // so the printed command always matches what executes.
  const tasks = urls.map((url, index) => ({
    url,
    index,
    args: buildYtDlpArgs(url, options, { progress: useRenderer }),
  }));

  if (options.printCommand || options.dryRun) {
    for (const task of tasks) {
      console.log(formatCommand("yt-dlp", task.args));
    }

    if (options.dryRun) {
      return;
    }
  }

  const ytDlpCommand = ensureCommand(
    "yt-dlp",
    "Install yt-dlp first: https://github.com/yt-dlp/yt-dlp#installation",
  );

  if (options.mp3) {
    ensureCommand("ffmpeg", "Install ffmpeg and make sure it is on PATH.");
  }

  await mkdir(options.outputDir, { recursive: true });

  // The aggregated progress block is only worth its complexity when several
  // downloads share one TTY. A single download keeps yt-dlp's native progress
  // (inherited stdio), which is already clean and battle-tested.
  // Lazy-load: progress module is only needed for the multi-download renderer.
  const progressMod = useRenderer ? await import("./progress.js") : null;
  const renderer = progressMod
    ? progressMod.createProgressRenderer(tasks.map((task) => shortLabel(task.url)))
    : null;

  const queue = [...tasks];
  const failures = [];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      const lineHandler = renderer
        ? (line) => {
            const info = progressMod.parseProgressLine(line);

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

function ensureCommand(command, installHint) {
  if (commandCache.has(command)) {
    return commandCache.get(command);
  }

  let executable = command;
  let probe = spawnSync(executable, ["--version"], { encoding: "utf8" });

  // Only when the bare command is missing do we look in the Windows fallback
  // locations. This keeps the happy path to a single `--version` probe.
  if (probe.error?.code === "ENOENT" && process.platform === "win32") {
    const fallback = resolveWindowsCommand(command);

    if (fallback) {
      executable = fallback;
      probe = spawnSync(executable, ["--version"], { encoding: "utf8" });
    }
  }

  if (probe.error?.code === "ENOENT") {
    const error = new Error(`${command} was not found on PATH.\n${installHint}`);
    error.exitCode = 127;
    throw error;
  }

  commandCache.set(command, executable);
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
        // Check startsWith first (no allocation) before trim() (allocates).
        // Progress lines ([download]…) are the vast majority; they skip trim.
        if (line && !line.startsWith("[download]") && line.trim()) {
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
