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

const VERSION = "0.3.0";

// Above this many URLs we skip the aggregated bar block (it would scroll the
// terminal) and fall back to yt-dlp's own inherited progress output.
const MAX_PROGRESS_BARS = 20;

export function run(argv, defaults = {}) {
  return main(argv, defaults).catch((error) => {
    const jsonMode = argv.includes("--json");

    if (jsonMode) {
      console.log(JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }

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
    console.log(`yt2audio ${VERSION}`);
    return;
  }

  // Defaults set by the entry point (e.g. yt4 -> video). Explicit flags win.
  parsed.options = { ...defaults, ...parsed.options };

  const wantsInteractive =
    parsed.options.interactive ||
    (parsed.urls.length === 0 &&
      process.stdin.isTTY &&
      !parsed.options.dryRun &&
      !parsed.options.printCommand &&
      !parsed.options.json);

  if (wantsInteractive) {
    const job = await promptForJob({ defaults: parsed.options });

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

  // Build each command exactly once and reuse it for both printing and running
  // so the printed command always matches what executes.
  const tasks = urls.map((url, index) => ({
    url,
    index,
    args: buildYtDlpArgs(url, options),
  }));

  if (options.printCommand || options.dryRun) {
    if (options.json) {
      const payload = {
        dryRun: Boolean(options.dryRun),
        version: VERSION,
        commands: tasks.map((task) => formatCommand("yt-dlp", task.args)),
      };
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

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
    !options.json &&
    urls.length <= MAX_PROGRESS_BARS;
  const renderer = useRenderer
    ? createProgressRenderer(tasks.map((task) => shortLabel(task.url)))
    : null;
  const results = options.json
    ? tasks.map((task) => ({
        url: task.url,
        status: "pending",
        file: null,
        error: null,
      }))
    : null;

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      const lineHandler = buildLineHandler(task, renderer, results);

      try {
        await runCommand(ytDlpCommand, task.args, { onLine: lineHandler });
        results?.[task.index] && (results[task.index].status = "ok");
        renderer?.done(task.index, true);
      } catch (error) {
        if (results?.[task.index]) {
          results[task.index].status = "error";
          results[task.index].error = error.message;
        }
        renderer?.done(task.index, false);
        failures.push({ url: task.url, error });
      }
    }
  }

  await Promise.all(Array.from({ length: jobs }, () => worker()));
  renderer?.finish();

  if (options.json) {
    const payload = {
      ok: failures.length === 0,
      version: VERSION,
      results: results.map(({ url, status, file, error }) => ({
        url,
        status,
        ...(file ? { file } : {}),
        ...(error ? { error } : {}),
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
  }

  if (failures.length > 0) {
    if (options.json) {
      process.exitCode = 1;
      return;
    }

    const lines = failures.map(({ url, error }) => `- ${url}: ${error.message}`);
    const error = new Error(`Download failed:\n${lines.join("\n")}`);
    error.exitCode = 1;
    throw error;
  }
}

function buildLineHandler(task, renderer, results) {
  if (!renderer && !results) {
    return undefined;
  }

  const captureFile = Boolean(results);

  return (line) => {
    if (renderer) {
      const info = parseProgressLine(line);

      if (info) {
        renderer.update(task.index, info);
      }
    }

    if (!captureFile) {
      return;
    }

    const destination = parseDestinationLine(line);

    if (destination) {
      results[task.index].file = destination;
    }
  };
}

export function parseDestinationLine(line) {
  const download = /\[download\]\s+Destination:\s*(.+)/.exec(line);

  if (download) {
    return download[1].trim();
  }

  const extract = /\[ExtractAudio\]\s+Destination:\s*(.+)/.exec(line);

  if (extract) {
    return extract[1].trim();
  }

  const merge = /\[Merger\]\s+Merging formats into "(.+)"/.exec(line);

  if (merge) {
    return merge[1].trim();
  }

  return null;
}

function ensureCommand(command, installHint) {
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
