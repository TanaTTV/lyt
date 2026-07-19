// `lyt doctor`: diagnoses core and optional capabilities.
//   lyt doctor           report only
//   lyt doctor --fix     auto-install anything lyt can safely manage
//   lyt doctor --update  update yt-dlp when supported
//   lyt doctor --json    emit one machine-readable diagnostic document

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { ensureFfmpeg, ensureYtDlp } from "./bootstrap.js";
import { clipboardCommands } from "./clipboard.js";
import { configPath } from "./config.js";
import { historyPath, loadHistory } from "./history.js";
import { binDir, dataDir } from "./paths.js";
import { VERSION } from "./version.js";

export async function runDoctor({
  fix = false,
  update = false,
  json = false,
  log = console.log,
} = {}) {
  const checks = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeOk = nodeMajor >= 20;

  checks.push({
    name: "node",
    required: true,
    ok: nodeOk,
    detail: `node ${process.versions.node}`,
    hint: nodeOk ? null : "lyt needs Node.js 20 or newer",
  });

  const ytDlp = await locate(() => ensureYtDlp({ noDownload: !fix }));
  checks.push({
    name: "yt-dlp",
    required: true,
    ok: Boolean(ytDlp.path),
    detail: ytDlp.path
      ? `yt-dlp ${version(ytDlp.path)} (${describe(ytDlp.path)})`
      : "yt-dlp not found",
    hint: ytDlp.path ? null : trimmed(ytDlp.error),
    path: ytDlp.path,
  });

  const ffmpeg = await locate(() => ensureFfmpeg({ noDownload: !fix }));
  checks.push({
    name: "ffmpeg",
    required: false,
    ok: Boolean(ffmpeg.path),
    detail: ffmpeg.path
      ? `ffmpeg ${version(ffmpeg.path, "-version")} (${describe(ffmpeg.path)})`
      : "ffmpeg unavailable",
    hint: ffmpeg.path
      ? null
      : `${trimmed(ffmpeg.error)} Required for MP3, video merging, clips, chapters, thumbnails, and normalization.`,
    path: ffmpeg.path,
  });

  const clipTool = probeClipboard();
  checks.push({
    name: "clipboard",
    required: false,
    ok: Boolean(clipTool),
    detail: clipTool
      ? `clipboard via ${clipTool[0]} (--paste / --watch ready)`
      : "clipboard integration unavailable",
    hint: clipTool ? null : "Install xclip, xsel, or wl-clipboard on Linux; other platforms use built-in tools.",
    command: clipTool?.[0] ?? null,
  });

  if (update) {
    const updateCheck = updateYtDlp(ytDlp.path);
    checks.push(updateCheck);
  }

  const paths = diagnosticPaths();
  const requiredOk = checks.filter((check) => check.required).every((check) => check.ok);
  const capabilities = {
    nativeAudio: nodeOk && Boolean(ytDlp.path),
    mp3: nodeOk && Boolean(ytDlp.path) && Boolean(ffmpeg.path),
    video: nodeOk && Boolean(ytDlp.path) && Boolean(ffmpeg.path),
    clips: nodeOk && Boolean(ytDlp.path) && Boolean(ffmpeg.path),
    clipboard: Boolean(clipTool),
  };

  const payload = {
    schema: "lyt.doctor.v1",
    version: VERSION,
    command: "doctor",
    ok: requiredOk,
    checks,
    capabilities,
    paths,
  };

  if (json) {
    log(JSON.stringify(payload));
  } else {
    printHumanReport(payload, { fix, log });
  }

  if (!requiredOk) {
    process.exitCode = 1;
  }

  return payload;
}

function updateYtDlp(path) {
  if (!path) {
    return {
      name: "yt-dlp-update",
      required: false,
      ok: false,
      detail: "yt-dlp could not be updated because it is unavailable",
      hint: "Run `lyt doctor --fix` first.",
    };
  }

  const result = spawnSync(path, ["-U"], {
    encoding: "utf8",
    timeout: 120000,
    windowsHide: true,
  });

  if (!result.error && result.status === 0) {
    return {
      name: "yt-dlp-update",
      required: false,
      ok: true,
      detail: "yt-dlp update completed",
      hint: null,
    };
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return {
    name: "yt-dlp-update",
    required: false,
    ok: false,
    detail: "yt-dlp self-update was not completed",
    hint: trimmed(output || result.error?.message || "Use the package manager that installed yt-dlp."),
  };
}

function diagnosticPaths() {
  const historyFile = historyPath();
  let historyEntries = null;
  let historyError = null;

  try {
    historyEntries = loadHistory(historyFile).length;
  } catch (error) {
    historyError = trimmed(error.message);
  }

  return {
    dataDir: dataDir(),
    toolsDir: binDir(),
    toolsDirExists: existsSync(binDir()),
    history: historyFile,
    historyEntries,
    historyError,
    config: configPath(),
    configExists: existsSync(configPath()),
  };
}

function printHumanReport(payload, { fix, log }) {
  log("lyt doctor");
  log("");
  log("Core");

  for (const check of payload.checks.filter((item) => item.required)) {
    printCheck(log, check);
  }

  log("");
  log("Optional capabilities");
  for (const check of payload.checks.filter((item) => !item.required)) {
    printCheck(log, check);
  }

  log("");
  log(`  data dir   ${payload.paths.dataDir}`);
  log(`  tools dir  ${payload.paths.toolsDir}${payload.paths.toolsDirExists ? "" : " (not created yet)"}`);
  log(`  history    ${payload.paths.history}${payload.paths.historyEntries == null
    ? ` (unavailable: ${payload.paths.historyError})`
    : ` (${payload.paths.historyEntries} entries)`}`);
  log(`  config     ${payload.paths.config}${payload.paths.configExists ? "" : " (defaults)"}`);
  log("");

  if (payload.ok) {
    const unavailable = payload.checks.filter((check) => !check.required && !check.ok).length;
    log(unavailable === 0
      ? "Everything looks good."
      : `lyt core is ready. ${unavailable} optional capability${unavailable === 1 ? " is" : "ies are"} unavailable.`);
  } else {
    const problems = payload.checks.filter((check) => check.required && !check.ok).length;
    log(`${problems} required problem${problems === 1 ? "" : "s"} found.`);
    if (!fix) log("Run `lyt doctor --fix` to install what lyt can safely manage.");
  }
}

function printCheck(log, check) {
  const marker = check.ok ? "[ok]" : check.required ? "[!!]" : "[--]";
  log(`  ${marker} ${check.detail}`);
  if (!check.ok && check.hint) log(`       ${check.hint}`);
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
    const first = `${result.stdout || ""}${result.stderr || ""}`
      .split("\n")[0]
      .trim();
    return first.replace(/^ffmpeg version\s+/, "").split(" ")[0] || "(unknown)";
  } catch {
    return "(unknown)";
  }
}

function describe(path) {
  if (path === "yt-dlp" || path === "ffmpeg") return "on PATH";
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
      if (!result.error && result.status === 0) return [command, args];
    } catch {
      // Try the next platform candidate.
    }
  }
  return null;
}

function trimmed(message) {
  return String(message ?? "").split("\n")[0];
}
