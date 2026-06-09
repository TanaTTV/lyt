// Auto-provision yt-dlp and ffmpeg binaries so users get a working install
// with zero manual setup on first run. Both tools are cached in a
// platform-specific directory and reused on subsequent runs.
//
// Cache locations:
//   Windows  %LOCALAPPDATA%\lyt\bin
//   macOS    ~/Library/Application Support/lyt/bin
//   Linux    ~/.local/share/lyt/bin
//
// Pass `noDownload: true` (or set LYT_NO_DOWNLOAD=1) to require the tools
// to be on PATH and skip all download logic.

import { chmodSync, existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { binDir } from "./paths.js";

// ---------------------------------------------------------------------------
// Managed binary directory (shared with history/config via paths.js)
// ---------------------------------------------------------------------------

function managedDir() {
  return binDir();
}

// ---------------------------------------------------------------------------
// yt-dlp
// ---------------------------------------------------------------------------

// GitHub releases provides a per-platform single binary with a SHA256SUMS file.
const YT_DLP_RELEASE_BASE =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function ytDlpReleaseAsset() {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return "yt-dlp";
}

function ytDlpCachedBin() {
  return join(managedDir(), process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
}

async function downloadYtDlp() {
  const asset = ytDlpReleaseAsset();

  // Verify before downloading: fetch the checksum manifest first.
  const sumsRes = await fetch(`${YT_DLP_RELEASE_BASE}/SHA256SUMS`);
  if (!sumsRes.ok) {
    throw new Error(`Could not fetch yt-dlp checksums (HTTP ${sumsRes.status})`);
  }
  const sums = await sumsRes.text();

  // Lines are:  <hex>  <filename>  (two spaces, no leading ./)
  const expectedHash = sums
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.endsWith(`  ${asset}`) || l.endsWith(` ${asset}`))
    ?.split(/\s+/)[0];

  if (!expectedHash) {
    throw new Error(`No checksum entry found for ${asset} in SHA256SUMS`);
  }

  process.stderr.write(`  Downloading yt-dlp from GitHub…\n`);
  const binRes = await fetch(`${YT_DLP_RELEASE_BASE}/${asset}`);
  if (!binRes.ok) {
    throw new Error(`yt-dlp download failed (HTTP ${binRes.status})`);
  }
  const data = Buffer.from(await binRes.arrayBuffer());

  const actualHash = createHash("sha256").update(data).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `yt-dlp checksum mismatch — file may be corrupt.\n` +
        `  expected ${expectedHash}\n  got      ${actualHash}`,
    );
  }

  await mkdir(managedDir(), { recursive: true });
  const dest = ytDlpCachedBin();
  await writeFile(dest, data);
  if (process.platform !== "win32") chmodSync(dest, 0o755);

  return dest;
}

/**
 * Locate yt-dlp: system PATH → platform-specific fallbacks → managed cache →
 * auto-download. Returns the path/command to pass to spawn().
 *
 * @param {{ noDownload?: boolean }} opts
 */
export async function ensureYtDlp({ noDownload = false } = {}) {
  // 1. On PATH already?
  if (probeOk("yt-dlp")) return "yt-dlp";

  // 2. Windows: check WinGet packages and known static paths.
  if (process.platform === "win32") {
    const win = resolveWindowsFallback("yt-dlp");
    if (win) return win;
  }

  // 3. Already in managed cache?
  const cached = ytDlpCachedBin();
  if (existsSync(cached) && probeOk(cached)) return cached;

  // 4. Auto-download unless opted out.
  if (noDownload) {
    const err = new Error(
      "yt-dlp was not found on PATH.\n" +
        "Install it: https://github.com/yt-dlp/yt-dlp#installation\n" +
        "Or remove --no-download / LYT_NO_DOWNLOAD to let lyt fetch it automatically.",
    );
    err.exitCode = 127;
    throw err;
  }

  process.stderr.write("yt-dlp not found — fetching to managed directory…\n");
  try {
    const dest = await downloadYtDlp();
    process.stderr.write(`yt-dlp installed at ${dest}\n`);
    return dest;
  } catch (cause) {
    const err = new Error(
      `Auto-install of yt-dlp failed: ${cause.message}\n` +
        "Install it manually: https://github.com/yt-dlp/yt-dlp#installation",
    );
    err.exitCode = 127;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------

function ffmpegCachedBin() {
  return join(
    managedDir(),
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
}

// On Windows we download the essentials build from Gyan's codexffmpeg repo and
// extract ffmpeg.exe using PowerShell (built into every Windows install).
async function downloadFfmpegWindows() {
  // Get the latest release metadata from the GitHub API.
  const apiRes = await fetch(
    "https://api.github.com/repos/GyanD/codexffmpeg/releases/latest",
    { headers: { "User-Agent": "lyt-cli" } },
  );
  if (!apiRes.ok) {
    throw new Error(`GitHub API error fetching ffmpeg release (HTTP ${apiRes.status})`);
  }
  const release = await apiRes.json();

  // The essentials build is the smallest option (~80 MB zip, ~40 MB extracted).
  const asset = release.assets?.find((a) =>
    /essentials.*\.zip$/i.test(a.name),
  );
  if (!asset) {
    throw new Error(
      "Could not find an essentials zip in the latest GyanD/codexffmpeg release",
    );
  }

  process.stderr.write(
    `  Downloading ${asset.name} (~80 MB, one-time only)…\n`,
  );
  const zipRes = await fetch(asset.browser_download_url);
  if (!zipRes.ok) {
    throw new Error(`ffmpeg download failed (HTTP ${zipRes.status})`);
  }
  const zipData = Buffer.from(await zipRes.arrayBuffer());

  // Write zip to a temp file then extract ffmpeg.exe with PowerShell.
  const { default: os } = await import("node:os");
  const { unlinkSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");

  const tmpZip = join(os.tmpdir(), `lyt-ffmpeg-${Date.now()}.zip`);
  await writeFile(tmpZip, zipData);
  await mkdir(managedDir(), { recursive: true });
  const dest = ffmpegCachedBin();

  // PowerShell is always present on Windows and understands .NET zip classes.
  const escapedZip = tmpZip.replace(/'/g, "''");
  const escapedDest = dest.replace(/'/g, "''");
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
        `$z = [IO.Compression.ZipFile]::OpenRead('${escapedZip}'); ` +
        `$e = $z.Entries | Where-Object { $_.Name -eq 'ffmpeg.exe' } | Select-Object -First 1; ` +
        `[IO.Compression.ZipFileExtensions]::ExtractToFile($e, '${escapedDest}', $true); ` +
        `$z.Dispose()`,
    ],
    { stdio: "ignore" },
  );

  try {
    unlinkSync(tmpZip);
  } catch {
    // Temp file cleanup failure is not fatal.
  }

  return dest;
}

/**
 * Locate ffmpeg: system PATH → platform-specific fallbacks → managed cache →
 * auto-download (Windows only; macOS/Linux show a helpful install hint).
 *
 * @param {{ noDownload?: boolean }} opts
 */
export async function ensureFfmpeg({ noDownload = false } = {}) {
  const FFMPEG_PROBE = ["-version"];

  // 1. On PATH?
  if (probeOk("ffmpeg", FFMPEG_PROBE)) return "ffmpeg";

  // 2. Windows fallbacks.
  if (process.platform === "win32") {
    const winStatic = join("C:\\", "ffmpeg", "bin", "ffmpeg.exe");
    if (existsSync(winStatic) && probeOk(winStatic, FFMPEG_PROBE)) return winStatic;

    const winget = resolveWindowsFallback("ffmpeg", FFMPEG_PROBE);
    if (winget) return winget;
  }

  // 3. Managed cache.
  const cached = ffmpegCachedBin();
  if (existsSync(cached) && probeOk(cached, FFMPEG_PROBE)) return cached;

  // 4. macOS / Linux: we don't bundle ffmpeg — provide a clear install hint.
  if (process.platform !== "win32") {
    const hint =
      process.platform === "darwin"
        ? "Install it: brew install ffmpeg"
        : "Install it: sudo apt install ffmpeg   (or your distro's package manager)";
    const err = new Error(`ffmpeg was not found on PATH.\n${hint}`);
    err.exitCode = 127;
    throw err;
  }

  // 5. Windows auto-download.
  if (noDownload) {
    const err = new Error(
      "ffmpeg was not found on PATH.\n" +
        "Install it: winget install Gyan.FFmpeg\n" +
        "Or remove --no-download / LYT_NO_DOWNLOAD to let lyt fetch it automatically.",
    );
    err.exitCode = 127;
    throw err;
  }

  process.stderr.write("ffmpeg not found — fetching to managed directory…\n");
  try {
    const dest = await downloadFfmpegWindows();
    process.stderr.write(`ffmpeg installed at ${dest}\n`);
    return dest;
  } catch (cause) {
    const err = new Error(
      `Auto-install of ffmpeg failed: ${cause.message}\n` +
        "Install it manually: winget install Gyan.FFmpeg",
    );
    err.exitCode = 127;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Note: ffmpeg only understands single-dash `-version`; `--version` makes it
// exit non-zero with the banner on stderr, which used to make every ffmpeg
// probe fail (and re-download ffmpeg on each run).
function probeOk(command, args = ["--version"]) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Search WinGet's Packages directory for a command's executable, since WinGet
 * doesn't always update PATH in the current shell session.
 */
function resolveWindowsFallback(command, probeArgs = ["--version"]) {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;

  const packagesDir = join(localAppData, "Microsoft", "WinGet", "Packages");
  if (!existsSync(packagesDir)) return null;

  const exe = `${command}.exe`;
  // Package dirs don't always start with the command name: yt-dlp lives in
  // "yt-dlp.yt-dlp_…" but ffmpeg lives in "Gyan.FFmpeg_…".
  const needle = command.toLowerCase();

  try {
    const dirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.toLowerCase().includes(needle))
      .map((e) => e.name)
      .sort();

    for (const dir of dirs) {
      // WinGet nests binaries differently per package; ffmpeg builds sit two
      // levels down ("<build>/bin/ffmpeg.exe"), so search a few levels deep.
      const found = findExecutable(join(packagesDir, dir), exe, 3);
      if (found && probeOk(found, probeArgs)) return found;
    }
  } catch {
    // readdirSync can throw on permission errors; treat as not-found.
  }

  return null;
}

function findExecutable(dir, exe, depth) {
  let entries;

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === exe.toLowerCase()) {
      return join(dir, entry.name);
    }
  }

  if (depth <= 0) return null;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findExecutable(join(dir, entry.name), exe, depth - 1);
      if (found) return found;
    }
  }

  return null;
}
