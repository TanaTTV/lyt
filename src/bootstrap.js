// Auto-provision yt-dlp and ffmpeg binaries so users get a working install
// with minimal manual setup. Both tools are cached in a platform-specific
// directory and reused on subsequent runs.

import {
  chmodSync,
  existsSync,
  readdirSync,
} from "node:fs";
import {
  mkdir,
  open,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { binDir } from "./paths.js";

const FETCH_TIMEOUT_MS = 60_000;
const LOCK_WAIT_MS = 30_000;
const LOCK_POLL_MS = 250;
const MAX_YT_DLP_BYTES = 64 * 1024 * 1024;
const MAX_FFMPEG_ARCHIVE_BYTES = 256 * 1024 * 1024;

function managedDir() {
  return binDir();
}

// ---------------------------------------------------------------------------
// yt-dlp
// ---------------------------------------------------------------------------

const YT_DLP_RELEASE_BASE =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
export const YT_DLP_CHECKSUM_ASSETS = ["SHA2-256SUMS", "SHA256SUMS"];

export function ytDlpReleaseAsset(platform = process.platform, arch = process.arch) {
  if (platform === "win32") {
    if (arch === "arm64") return "yt-dlp_arm64.exe";
    if (arch === "ia32") return "yt-dlp_x86.exe";
    return "yt-dlp.exe";
  }
  if (platform === "darwin") return "yt-dlp_macos";
  if (platform === "linux") {
    if (arch === "arm64") return "yt-dlp_linux_aarch64";
    if (arch === "x64") return "yt-dlp_linux";
  }
  return "yt-dlp";
}

function ytDlpCachedBin() {
  return join(managedDir(), process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
}

async function downloadYtDlp() {
  const asset = ytDlpReleaseAsset();
  const sums = await fetchYtDlpChecksums();
  const expectedHash = checksumForAsset(sums, asset);

  if (!expectedHash) {
    throw new Error(`No checksum entry found for ${asset} in the SHA-256 manifest`);
  }

  process.stderr.write("  Downloading yt-dlp from GitHub…\n");
  const response = await fetchChecked(`${YT_DLP_RELEASE_BASE}/${asset}`);
  const data = await readBounded(response, MAX_YT_DLP_BYTES, "yt-dlp");
  verifySha256(data, expectedHash, asset);

  const dest = ytDlpCachedBin();
  await atomicWrite(dest, data, { executable: process.platform !== "win32" });
  return dest;
}

export async function fetchYtDlpChecksums(fetchFn = fetch) {
  const failures = [];

  for (const filename of YT_DLP_CHECKSUM_ASSETS) {
    const response = await fetchFn(`${YT_DLP_RELEASE_BASE}/${filename}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.ok) return response.text();
    failures.push(`${filename} (HTTP ${response.status})`);
  }

  throw new Error(`Could not fetch yt-dlp checksums: ${failures.join(", ")}`);
}

export function checksumForAsset(manifest, asset) {
  return String(manifest)
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.endsWith(`  ${asset}`) || line.endsWith(` ${asset}`))
    ?.split(/\s+/)[0] ?? null;
}

export async function ensureYtDlp({ noDownload = false } = {}) {
  if (probeOk("yt-dlp")) return "yt-dlp";

  if (process.platform === "win32") {
    const win = resolveWindowsFallback("yt-dlp");
    if (win) return win;
  }

  const cached = ytDlpCachedBin();
  if (existsSync(cached) && probeOk(cached)) return cached;

  if (noDownload) {
    const error = new Error(
      "yt-dlp was not found on PATH.\n" +
        "Install it from the official yt-dlp project, or remove --no-download / " +
        "LYT_NO_DOWNLOAD to let lyt fetch the verified release binary.",
    );
    error.exitCode = 127;
    throw error;
  }

  process.stderr.write("yt-dlp not found — fetching to managed directory…\n");

  try {
    const dest = await withInstallLock("yt-dlp", async () => {
      if (existsSync(cached) && probeOk(cached)) return cached;
      return downloadYtDlp();
    });
    process.stderr.write(`yt-dlp installed at ${dest}\n`);
    return dest;
  } catch (cause) {
    const error = new Error(
      `Auto-install of yt-dlp failed: ${cause.message}\n` +
        "Install it manually from the official yt-dlp project.",
    );
    error.exitCode = 127;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// ffmpeg (managed automatically on Windows; guided elsewhere)
// ---------------------------------------------------------------------------

function ffmpegCachedBin() {
  return join(managedDir(), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

async function downloadFfmpegWindows() {
  const apiResponse = await fetchChecked(
    "https://api.github.com/repos/GyanD/codexffmpeg/releases/latest",
    { headers: { "User-Agent": "lyt-cli" } },
  );
  const release = await apiResponse.json();
  const asset = release.assets?.find((candidate) =>
    /essentials.*\.zip$/i.test(candidate.name),
  );

  if (!asset) {
    throw new Error("Could not find an ffmpeg essentials ZIP in the latest release");
  }

  if (Number(asset.size) > MAX_FFMPEG_ARCHIVE_BYTES) {
    throw new Error(`Refusing unexpectedly large ffmpeg asset (${asset.size} bytes)`);
  }

  const expectedHash = await resolveReleaseChecksum(release, asset);
  if (!expectedHash) {
    throw new Error(`No trusted SHA-256 digest was published for ${asset.name}`);
  }

  process.stderr.write(`  Downloading ${asset.name} (one-time setup)…\n`);
  const zipResponse = await fetchChecked(asset.browser_download_url);
  const zipData = await readBounded(
    zipResponse,
    MAX_FFMPEG_ARCHIVE_BYTES,
    "ffmpeg archive",
  );
  verifySha256(zipData, expectedHash, asset.name);

  const { default: os } = await import("node:os");
  const { execFileSync } = await import("node:child_process");
  const tmpZip = join(os.tmpdir(), `lyt-ffmpeg-${process.pid}-${Date.now()}.zip`);
  const dest = ffmpegCachedBin();
  const tmpExe = `${dest}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(managedDir(), { recursive: true });
  await writeFile(tmpZip, zipData, { flag: "wx" });

  try {
    const escapedZip = powershellLiteral(tmpZip);
    const escapedDest = powershellLiteral(tmpExe);
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
          `$z = [IO.Compression.ZipFile]::OpenRead('${escapedZip}'); ` +
          `$e = $z.Entries | Where-Object { $_.Name -eq 'ffmpeg.exe' } | Select-Object -First 1; ` +
          `if (-not $e) { $z.Dispose(); throw 'ffmpeg.exe not found in archive' }; ` +
          `[IO.Compression.ZipFileExtensions]::ExtractToFile($e, '${escapedDest}', $true); ` +
          `$z.Dispose()`,
      ],
      { stdio: "ignore", timeout: 120_000, windowsHide: true },
    );

    if (!probeOk(tmpExe, ["-version"])) {
      throw new Error("Extracted ffmpeg executable failed its version check");
    }

    await replaceFile(tmpExe, dest);
    return dest;
  } finally {
    await rm(tmpZip, { force: true });
    await rm(tmpExe, { force: true });
  }
}

async function resolveReleaseChecksum(release, asset) {
  const digest = String(asset.digest ?? "");
  const direct = /^sha256:([a-f0-9]{64})$/i.exec(digest)?.[1];
  if (direct) return direct.toLowerCase();

  const checksumAsset = release.assets?.find((candidate) =>
    candidate.id !== asset.id &&
    /(?:sha256|checksum|checksums)/i.test(candidate.name) &&
    /(?:\.txt|\.sha256|\.sum)$/i.test(candidate.name),
  );

  if (!checksumAsset) return null;
  const response = await fetchChecked(checksumAsset.browser_download_url);
  const manifest = await response.text();
  return checksumForAsset(manifest, asset.name)?.toLowerCase() ?? null;
}

export async function ensureFfmpeg({ noDownload = false } = {}) {
  const probeArgs = ["-version"];
  if (probeOk("ffmpeg", probeArgs)) return "ffmpeg";

  if (process.platform === "win32") {
    const staticPath = join("C:\\", "ffmpeg", "bin", "ffmpeg.exe");
    if (existsSync(staticPath) && probeOk(staticPath, probeArgs)) return staticPath;

    const winget = resolveWindowsFallback("ffmpeg", probeArgs);
    if (winget) return winget;
  }

  const cached = ffmpegCachedBin();
  if (existsSync(cached) && probeOk(cached, probeArgs)) return cached;

  if (process.platform !== "win32") {
    const hint = process.platform === "darwin"
      ? "Install it with: brew install ffmpeg"
      : "Install it with your distribution package manager, for example: sudo apt install ffmpeg";
    const error = new Error(`ffmpeg was not found on PATH.\n${hint}`);
    error.exitCode = 127;
    throw error;
  }

  if (noDownload) {
    const error = new Error(
      "ffmpeg was not found on PATH.\n" +
        "Install it with WinGet, or remove --no-download / LYT_NO_DOWNLOAD " +
        "to let lyt fetch a verified Windows build.",
    );
    error.exitCode = 127;
    throw error;
  }

  process.stderr.write("ffmpeg not found — fetching to managed directory…\n");

  try {
    const dest = await withInstallLock("ffmpeg", async () => {
      if (existsSync(cached) && probeOk(cached, probeArgs)) return cached;
      return downloadFfmpegWindows();
    });
    process.stderr.write(`ffmpeg installed at ${dest}\n`);
    return dest;
  } catch (cause) {
    const error = new Error(
      `Auto-install of ffmpeg failed: ${cause.message}\n` +
        "Install it manually with: winget install Gyan.FFmpeg",
    );
    error.exitCode = 127;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Download and filesystem helpers
// ---------------------------------------------------------------------------

async function fetchChecked(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response;
}

async function readBounded(response, maxBytes, label) {
  const advertised = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(advertised) && advertised > maxBytes) {
    throw new Error(`${label} exceeded the ${maxBytes}-byte safety limit`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) {
    throw new Error(`${label} exceeded the ${maxBytes}-byte safety limit`);
  }
  return data;
}

function verifySha256(data, expectedHash, asset) {
  const actualHash = createHash("sha256").update(data).digest("hex");
  if (actualHash !== String(expectedHash).toLowerCase()) {
    throw new Error(
      `${asset} checksum mismatch — refusing to install.\n` +
        `  expected ${expectedHash}\n  got      ${actualHash}`,
    );
  }
}

async function atomicWrite(dest, data, { executable = false } = {}) {
  await mkdir(managedDir(), { recursive: true });
  const temporary = `${dest}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, data, { flag: "wx" });

  try {
    if (executable) chmodSync(temporary, 0o755);
    await replaceFile(temporary, dest);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function replaceFile(source, destination) {
  try {
    await rename(source, destination);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
    await rm(destination, { force: true });
    await rename(source, destination);
  }
}

async function withInstallLock(name, task) {
  await mkdir(managedDir(), { recursive: true });
  const lockPath = join(managedDir(), `${name}.install.lock`);
  const started = Date.now();
  let handle;

  while (!handle) {
    try {
      handle = await open(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new Error(`Timed out waiting for another ${name} installation`);
      }
      await sleep(LOCK_POLL_MS);
    }
  }

  try {
    return await task();
  } finally {
    await handle.close().catch(() => {});
    await rm(lockPath, { force: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function powershellLiteral(value) {
  return String(value).replaceAll("'", "''");
}

// ---------------------------------------------------------------------------
// Tool discovery helpers
// ---------------------------------------------------------------------------

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

function resolveWindowsFallback(command, probeArgs = ["--version"]) {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;

  const packagesDir = join(localAppData, "Microsoft", "WinGet", "Packages");
  if (!existsSync(packagesDir)) return null;

  const exe = `${command}.exe`;
  const needle = command.toLowerCase();

  try {
    const dirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().includes(needle))
      .map((entry) => entry.name)
      .sort();

    for (const dir of dirs) {
      const found = findExecutable(join(packagesDir, dir), exe, 3);
      if (found && probeOk(found, probeArgs)) return found;
    }
  } catch {
    // Treat permission and transient filesystem errors as not-found.
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
