// `lyt doctor`: diagnoses the environment and prints actionable fixes.
//   lyt doctor           report only
//   lyt doctor --fix     auto-install anything missing (yt-dlp everywhere,
//                        ffmpeg on Windows; package-manager hints elsewhere)
//   lyt doctor --update  self-update yt-dlp (yt-dlp -U)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { ensureFfmpeg, ensureYtDlp } from "./bootstrap.js";
import { clipboardCommands } from "./clipboard.js";
import { configPath } from "./config.js";
import { historyPath, loadHistory } from "./history.js";
import { binDir, dataDir } from "./paths.js";

export async function runDoctor({ fix = false, update = false, log = console.log } = {}) {
  let problems = 0;

  log("lyt doctor");
  log("");

  // Node
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  report(log, nodeMajor >= 20, `node ${process.versions.node}`, "lyt needs Node.js 20+");
  if (nodeMajor < 20) problems += 1;

  // yt-dlp
  const ytDlp = await locate(() => ensureYtDlp({ noDownload: !fix }));
  if (ytDlp.path) {
    report(log, true, `yt-dlp ${version(ytDlp.path)} (${describe(ytDlp.path)})`);
  } else {
    problems += 1;
    report(log, false, "yt-dlp not found", trimmed(ytDlp.error));
  }

  // ffmpeg (only understands single-dash -version)
  const ffmpeg = await locate(() => ensureFfmpeg({ noDownload: !fix }));
  if (ffmpeg.path) {
    report(log, true, `ffmpeg ${version(ffmpeg.path, "-version")} (${describe(ffmpeg.path)})`);
  } else {
    problems += 1;
    report(log, false, "ffmpeg not found", trimmed(ffmpeg.error));
  }

  // Clipboard tooling (used by --paste and --watch)
  const clipTool = probeClipboard();
  report(
    log,
    Boolean(clipTool),
    clipTool
      ? `clipboard via ${clipTool[0]} (--paste / --watch ready)`
      : "no clipboard tool found (--paste / --watch unavailable)",
    clipTool ? undefined : "install xclip, xsel, or wl-clipboard",
  );

  // Data locations
  log("");
  log(`  data dir   ${dataDir()}`);
  log(`  tools dir  ${binDir()}${existsSync(binDir()) ? "" : " (not created yet)"}`);
  const historyFile = historyPath();
  try {
    log(`  history    ${historyFile} (${loadHistory(historyFile).length} entries)`);
  } catch (error) {
    problems += 1;
    log(`  history    ${historyFile} (unavailable: ${trimmed(error.message)})`);
  }
  log(`  config     ${configPath()}${existsSync(configPath()) ? "" : " (defaults)"}`);

  // Self-update
  if (update) {
    log("");
    if (!ytDlp.path) {
      log("  cannot update yt-dlp: it is not installed (try: lyt doctor --fix)");
      problems += 1;
    } else {
      log(`  updating yt-dlp (${ytDlp.path} -U)...`);
      const result = spawnSync(ytDlp.path, ["-U"], { stdio: "inherit" });

      if (result.status !== 0) {
        log("  yt-dlp self-update failed; re-run with --fix to re-download it.");
        problems += 1;
      }
    }
  }

  log("");
  if (problems === 0) {
    log("Everything looks good.");
  } else {
    log(`${problems} problem${problems === 1 ? "" : "s"} found.`);
    if (!fix) {
      log("Run `lyt doctor --fix` to auto-install what can be auto-installed.");
    }
    process.exitCode = 1;
  }
}

async function locate(ensure) {
  try {
    return { path: await ensure() };
  } catch (error) {
    return { path: null, error: error.message };
  }
}

function version(command, flag = "--version") {
  try {
    const result = spawnSync(command, [flag], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    });
    // ffmpeg prints "ffmpeg version N-…" plus a banner; keep it short.
    const first = ((result.stdout || "") + (result.stderr || ""))
      .split("\n")[0]
      .trim();
    return first.replace(/^ffmpeg version\s+/, "").split(" ")[0] || "(unknown)";
  } catch {
    return "(unknown)";
  }
}

function describe(path) {
  if (path === "yt-dlp" || path === "ffmpeg") {
    return "on PATH";
  }

  return path.startsWith(binDir()) ? `managed: ${path}` : path;
}

function probeClipboard() {
  for (const [command, args] of clipboardCommands()) {
    try {
      const result = spawnSync(command, args, {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      });

      if (!result.error && result.status === 0) {
        return [command, args];
      }
    } catch {
      // Try the next platform candidate.
    }
  }

  return null;
}

function trimmed(message) {
  return String(message ?? "").split("\n")[0];
}

function report(log, ok, text, hint) {
  log(`  ${ok ? "[ok]" : "[!!]"} ${text}`);

  if (!ok && hint) {
    log(`       ${hint}`);
  }
}
