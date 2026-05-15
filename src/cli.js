import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  buildYtDlpArgs,
  formatCommand,
  normalizeOptions,
  parseArgs,
  usage,
} from "./ytDlp.js";

export async function main(argv) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  if (parsed.version) {
    console.log("yt2audio 0.1.0");
    return;
  }

  const options = normalizeOptions(parsed.options);
  const urls = parsed.urls;

  if (urls.length === 0) {
    const error = new Error(`${usage()}\n\nMissing URL.`);
    error.exitCode = 2;
    throw error;
  }

  const jobs = Math.min(options.jobs, urls.length);
  const queue = [...urls];
  const failures = [];

  if (options.printCommand || options.dryRun) {
    for (const url of urls) {
      console.log(formatCommand("yt-dlp", buildYtDlpArgs(url, options)));
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

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      const args = buildYtDlpArgs(url, options);

      try {
        await runCommand(ytDlpCommand, args);
      } catch (error) {
        failures.push({ url, error });
      }
    }
  }

  await Promise.all(Array.from({ length: jobs }, () => worker()));

  if (failures.length > 0) {
    const lines = failures.map(({ url, error }) => `- ${url}: ${error.message}`);
    const error = new Error(`Download failed:\n${lines.join("\n")}`);
    error.exitCode = 1;
    throw error;
  }
}

function ensureCommand(command, installHint) {
  const executable = resolveCommand(command);
  const probe = spawnSync(executable, ["--version"], { encoding: "utf8" });

  if (probe.error?.code === "ENOENT") {
    const error = new Error(`${command} was not found on PATH.\n${installHint}`);
    error.exitCode = 127;
    throw error;
  }

  return executable;
}

function resolveCommand(command) {
  const directProbe = spawnSync(command, ["--version"], { encoding: "utf8" });

  if (!directProbe.error) {
    return command;
  }

  if (process.platform !== "win32") {
    return command;
  }

  const executable = `${command}.exe`;
  const knownPaths = [
    join("C:\\", "ffmpeg", "bin", executable),
    findWinGetExecutable(command, executable),
  ].filter(Boolean);

  return knownPaths.find((candidate) => existsSync(candidate)) ?? command;
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
      .map((entry) => entry.name);
    const preferredDir = packageDirs.find((name) => name.toLowerCase().startsWith(`${command.toLowerCase()}.`));

    if (!preferredDir) {
      return null;
    }

    return join(packagesDir, preferredDir, executable);
  } catch {
    return null;
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const error = new Error(`${command} exited with code ${code}`);
      error.exitCode = code;
      reject(error);
    });
  });
}

export function outputTemplate(outputDir, template) {
  return join(outputDir, template);
}

export function outputParent(outputPath) {
  return dirname(outputPath);
}
