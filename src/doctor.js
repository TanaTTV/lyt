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
import { resolveExecutableOnPath } from "./executables.js";
import { historyPath, loadHistory } from "./history.js";
import { binDir, dataDir } from "./paths.js";
import { loadConfig } from "./config.js";
import { VERSION } from "./version.js";
import {
  checkForUpdate,
  isUpdateCheckEnabled,
} from "./updateCheck.js";
import { err, heading, muted, ok } from "./ui.js";

export async function runDoctor({
  fix = false,
  update = false,
  checkUpdates = false,
  network = false,
  json = false,
  log = console.log,
  fetchImpl = globalThis.fetch,
} = {}) {
  const checks = [];
  const probeResults = new Map();
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeOk = nodeMajor >= 20;

  checks.push({
    name: "node",
    required: true,
    ok: nodeOk,
    detail: `node ${process.versions.node}`,
    hint: nodeOk ? null : "lyt needs Node.js 20 or newer",
  });

  // Network update discovery can run while local capabilities are checked.
  const updatePromise = lytVersionCheck({ force: checkUpdates });

  const ytDlp = await locate(() => ensureYtDlp({ noDownload: !fix, probeResults }));
  checks.push({
    name: "yt-dlp",
    required: true,
    ok: Boolean(ytDlp.path),
    detail: ytDlp.path
      ? `yt-dlp ${version(ytDlp.path, "--version", probeResults)} (${describe(ytDlp.path)})`
      : "yt-dlp not found",
    hint: ytDlp.path ? null : trimmed(ytDlp.error),
    path: ytDlp.path,
  });

  const ffmpeg = await locate(() => ensureFfmpeg({ noDownload: !fix, probeResults }));
  checks.push({
    name: "ffmpeg",
    required: false,
    ok: Boolean(ffmpeg.path),
    detail: ffmpeg.path
      ? `ffmpeg ${version(ffmpeg.path, "-version", probeResults)} (${describe(ffmpeg.path)})`
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

  if (network) {
    checks.push(...(await checkNetwork({ fetchImpl })));
  }

  checks.splice(1, 0, await updatePromise);

  const paths = diagnosticPaths();
  const commandOk = doctorCommandSucceeded(checks, { update });
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
    ok: commandOk,
    checks,
    capabilities,
    paths,
  };

  if (json) {
    log(JSON.stringify(payload));
  } else {
    printHumanReport(payload, { fix, log });
  }

  if (!commandOk) {
    process.exitCode = 1;
  }

  return payload;
}

// Sites lyt talks to directly or most often. Optional checks: a blocked site
// only affects links from that site.
export const NETWORK_TARGETS = [
  { name: "network-youtube", label: "YouTube", url: "https://www.youtube.com/" },
  { name: "network-spotify", label: "Spotify (track lists)", url: "https://open.spotify.com/" },
  { name: "network-soundcloud", label: "SoundCloud", url: "https://soundcloud.com/" },
  { name: "network-github", label: "GitHub (yt-dlp updates)", url: "https://github.com/" },
];

// `lyt doctor --network`: can this machine reach the sites lyt uses?
export async function checkNetwork({ fetchImpl = globalThis.fetch, timeoutMs = 6000, targets = NETWORK_TARGETS } = {}) {
  return Promise.all(targets.map(async (target) => {
    const started = Date.now();
    try {
      const response = await fetchImpl(target.url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (lyt doctor)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Any HTTP answer, even an error page, means the site is reachable.
      const ms = Date.now() - started;
      return {
        name: target.name,
        required: false,
        ok: true,
        detail: `${target.label} reachable (HTTP ${response.status}, ${ms} ms)`,
        hint: null,
      };
    } catch (error) {
      return {
        name: target.name,
        required: false,
        ok: false,
        detail: `${target.label} not reachable`,
        hint: trimmed(error?.cause?.code ?? error?.name ?? error?.message ?? "network error") +
          ". Check your connection, proxy, or firewall.",
      };
    }
  }));
}

export function doctorCommandSucceeded(checks, { update = false } = {}) {
  const requiredOk = checks
    .filter((check) => check.required)
    .every((check) => check.ok);
  const updateChecks = checks.filter((check) => check.name === "yt-dlp-update");
  const updateOk = !update || (
    updateChecks.length === 1 && updateChecks.every((check) => check.ok)
  );
  return requiredOk && updateOk;
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
  const stream = process.stdout;
  log(heading("lyt doctor", stream));
  log("");
  log(heading("Core", stream));

  for (const check of payload.checks.filter((item) => item.required)) {
    printCheck(log, check, stream);
  }

  log("");
  log(heading("Optional capabilities", stream));
  for (const check of payload.checks.filter((item) => !item.required)) {
    printCheck(log, check, stream);
  }

  log("");
  log(`  ${muted("data dir", stream)}   ${payload.paths.dataDir}`);
  log(`  ${muted("tools dir", stream)}  ${payload.paths.toolsDir}${payload.paths.toolsDirExists ? "" : " (not created yet)"}`);
  log(`  ${muted("history", stream)}    ${payload.paths.history}${payload.paths.historyEntries == null
    ? ` (unavailable: ${payload.paths.historyError})`
    : ` (${payload.paths.historyEntries} entries)`}`);
  log(`  ${muted("config", stream)}     ${payload.paths.config}${payload.paths.configExists ? "" : " (defaults)"}`);
  log("");

  if (payload.ok) {
    const unavailable = payload.checks.filter((check) => !check.required && !check.ok).length;
    log(unavailable === 0
      ? ok("Everything looks good.", stream)
      : `lyt core is ready. ${unavailable} optional capability${unavailable === 1 ? " is" : "ies are"} unavailable.`);
  } else {
    const problems = payload.checks.filter((check) => check.required && !check.ok).length;
    const updateFailed = payload.checks.some((check) =>
      check.name === "yt-dlp-update" && !check.ok,
    );
    if (problems > 0) {
      log(err(`${problems} required problem${problems === 1 ? "" : "s"} found.`, stream));
      if (!fix) log("Run `lyt doctor --fix` to install what lyt can safely manage.");
    }
    if (updateFailed) log("The requested yt-dlp update was not completed.");
  }
}

function printCheck(log, check, stream = process.stdout) {
  const marker = check.ok
    ? ok("[ok]", stream)
    : check.required
      ? err("[!!]", stream)
      : muted("[--]", stream);
  log(`  ${marker} ${check.detail}`);
  if (check.hint) log(`       ${muted(check.hint, stream)}`);
}

export async function lytVersionCheck({
  force = false, config = loadConfig(), check = checkForUpdate,
} = {}) {
  const enabled = isUpdateCheckEnabled(config);
  if (!enabled) {
    return {
      name: "lyt",
      required: false,
      ok: true,
      detail: `lyt ${VERSION} (update checks disabled)`,
      hint: null,
    };
  }

  const update = await check({ force });
  if (!update) {
    return {
      name: "lyt",
      required: false,
      ok: true,
      detail: `lyt ${VERSION}`,
      hint: "Could not reach npm to check for a newer lyt release.",
    };
  }

  if (update.source === "stale-cache") {
    return {
      name: "lyt", required: false, ok: true,
      detail: `lyt ${VERSION} (cached latest ${update.latestVersion}; current registry status unknown)`,
      hint: update.updateAvailable
        ? `${update.installCommand} — cached notice; run lyt doctor --check-updates to refresh.`
        : "Could not refresh npm update information. Run lyt doctor --check-updates when online.",
    };
  }

  if (update.updateAvailable) {
    return {
      name: "lyt",
      required: false,
      ok: false,
      detail: `lyt ${VERSION} (latest ${update.latestVersion})`,
      hint: update.installCommand,
    };
  }

  return {
    name: "lyt",
    required: false,
    ok: true,
    detail: `lyt ${VERSION} (${update.source === "cache" ? "cached npm latest" : "npm latest"} ${update.latestVersion}; ${update.checkedAt ?? "check time unknown"})`,
    hint: null,
  };
}

async function locate(ensure) {
  try {
    return { path: await ensure() };
  } catch (error) {
    return { path: null, error: error.message };
  }
}

function version(command, flag = "--version", probeResults) {
  try {
    const result = probeResults?.get(command) ?? spawnSync(command, [flag], {
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
      const executable = resolveExecutableOnPath(command);
      if (!executable) continue;
      const result = spawnSync(executable, args, {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      });
      if (!result.error && result.status === 0) return [executable, args];
    } catch {
      // Try the next platform candidate.
    }
  }
  return null;
}

function trimmed(message) {
  return String(message ?? "").split("\n")[0];
}
