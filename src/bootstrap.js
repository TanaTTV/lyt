// Auto-provisioning of the external tools lyt depends on (yt-dlp, ffmpeg).
//
// Resolution order for each tool:
//   1. PATH (and the Windows fallback locations) — a system install always wins.
//   2. lyt's own managed cache (~/.local/share/lyt/bin or the OS equivalent).
//   3. Download the official binary into that cache, verify it, and use it.
//
// This keeps the npm package tiny and the runtime dependency-free while letting
// users install nothing but `lyt` itself. Set LYT_NO_DOWNLOAD=1 (or pass
// --no-download) to disable step 3 and require a manual install instead.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import https from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const YTDLP_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const FFMPEG_BASE =
  "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download";

// Per-user data directory where lyt keeps the binaries it downloads.
export function lytDataDir(env = process.env, platform = process.platform) {
  if (platform === "win32") {
    const base =
      env.LOCALAPPDATA || join(env.USERPROFILE || homedir(), "AppData", "Local");
    return join(base, "lyt");
  }

  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "lyt");
  }

  const base = env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "lyt");
}

export function lytBinDir(env = process.env, platform = process.platform) {
  return join(lytDataDir(env, platform), "bin");
}

// Which yt-dlp release asset to fetch, and what to call it locally. yt-dlp
// ships self-contained binaries, so no Python is required.
export function ytDlpAsset(platform = process.platform, arch = process.arch) {
  if (platform === "win32") {
    return { asset: "yt-dlp.exe", out: "yt-dlp.exe" };
  }

  if (platform === "darwin") {
    return { asset: "yt-dlp_macos", out: "yt-dlp" };
  }

  if (arch === "arm64" || arch === "aarch64") {
    return { asset: "yt-dlp_linux_aarch64", out: "yt-dlp" };
  }

  return { asset: "yt-dlp_linux", out: "yt-dlp" };
}

// ffmpeg has no single official binary, so we pull well-known static builds:
// BtbN's GitHub releases for Windows/Linux. macOS isn't built by BtbN, so we
// fall back to evermeet.cx there.
export function ffmpegSource(platform = process.platform, arch = process.arch) {
  if (platform === "win32") {
    return {
      url: `${FFMPEG_BASE}/ffmpeg-master-latest-win64-gpl.zip`,
      archive: "zip",
      binary: "ffmpeg.exe",
      out: "ffmpeg.exe",
    };
  }

  if (platform === "darwin") {
    return {
      url: "https://evermeet.cx/ffmpeg/getrelease/zip",
      archive: "zip",
      binary: "ffmpeg",
      out: "ffmpeg",
    };
  }

  const slug = arch === "arm64" || arch === "aarch64" ? "linuxarm64" : "linux64";
  return {
    url: `${FFMPEG_BASE}/ffmpeg-master-latest-${slug}-gpl.tar.xz`,
    archive: "tar.xz",
    binary: "ffmpeg",
    out: "ffmpeg",
  };
}

// Stream a URL to disk, following the redirects GitHub/evermeet use to hand off
// to their CDNs. Injectable httpsModule keeps this testable without a network.
export function downloadTo(url, dest, { httpsModule = https, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpsModule.get(url, (response) => {
      const { statusCode = 0, headers = {} } = response;

      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        response.resume();

        if (redirects <= 0) {
          reject(new Error(`Too many redirects fetching ${url}`));
          return;
        }

        downloadTo(headers.location, dest, { httpsModule, redirects: redirects - 1 })
          .then(resolve, reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed (HTTP ${statusCode}) for ${url}`));
        return;
      }

      const file = createWriteStream(dest);
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
      file.on("error", (error) => {
        rmSync(dest, { force: true });
        reject(error);
      });
    });

    request.on("error", reject);
  });
}

export function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

// yt-dlp publishes a SHA2-256SUMS file listing "<hash>  <asset>" per line.
export function findChecksum(sumsText, asset) {
  for (const line of sumsText.split("\n")) {
    const match = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);

    if (match && match[2].trim() === asset) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

// Locate a binary by name anywhere inside an extracted archive tree.
export function findBinary(root, name) {
  let entries;

  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const full = join(root, entry.name);

    if (entry.isDirectory()) {
      const nested = findBinary(full, name);

      if (nested) {
        return nested;
      }
    } else if (entry.name === name) {
      return full;
    }
  }

  return null;
}

function downloadEnabled(allowDownload, env = process.env) {
  if (allowDownload === false) {
    return false;
  }

  const flag = env.LYT_NO_DOWNLOAD;
  return !(flag === "1" || flag === "true");
}

// Probe a binary's --version to confirm it actually runs on this machine.
function runs(executable, spawnFn = spawnSync) {
  const probe = spawnFn(executable, ["--version"], { encoding: "utf8" });
  return !probe.error;
}

// Resolve yt-dlp: PATH probe (caller-supplied) -> cache -> download + verify.
export async function ensureYtDlp({
  onPath = null,
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  spawnFn = spawnSync,
  httpsModule = https,
  allowDownload,
  log = () => {},
} = {}) {
  if (onPath) {
    return onPath;
  }

  const { asset, out } = ytDlpAsset(platform, arch);
  const binDir = lytBinDir(env, platform);
  const dest = join(binDir, out);

  if (existsSync(dest) && runs(dest, spawnFn)) {
    return dest;
  }

  if (!downloadEnabled(allowDownload, env)) {
    return null;
  }

  mkdirSync(binDir, { recursive: true });
  log(`Downloading yt-dlp (${asset})…`);

  const tmp = `${dest}.download`;
  await downloadTo(`${YTDLP_BASE}/${asset}`, tmp, { httpsModule });

  // Best-effort integrity check against the published checksums file.
  try {
    const sumsPath = join(binDir, "SHA2-256SUMS");
    await downloadTo(`${YTDLP_BASE}/SHA2-256SUMS`, sumsPath, { httpsModule });
    const expected = findChecksum(readFileSync(sumsPath, "utf8"), asset);
    rmSync(sumsPath, { force: true });

    if (expected && sha256(tmp) !== expected) {
      rmSync(tmp, { force: true });
      throw new Error("yt-dlp checksum mismatch — refusing to use the download.");
    }
  } catch (error) {
    if (/checksum mismatch/.test(error.message)) {
      throw error;
    }
    // A failed checksum *fetch* shouldn't block install; the binary still came
    // from the official release URL over HTTPS.
  }

  renameSync(tmp, dest);
  chmodSync(dest, 0o755);
  return dest;
}

// Resolve ffmpeg: PATH probe -> cache -> download archive, extract, install.
export async function ensureFfmpeg({
  onPath = null,
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  spawnFn = spawnSync,
  httpsModule = https,
  allowDownload,
  log = () => {},
} = {}) {
  if (onPath) {
    return onPath;
  }

  const source = ffmpegSource(platform, arch);
  const binDir = lytBinDir(env, platform);
  const dest = join(binDir, source.out);

  if (existsSync(dest) && runs(dest, spawnFn)) {
    return dest;
  }

  if (!downloadEnabled(allowDownload, env)) {
    return null;
  }

  mkdirSync(binDir, { recursive: true });
  log("Downloading ffmpeg (one-time, ~30–80MB)…");

  const archivePath = join(binDir, `ffmpeg-archive.${source.archive}`);
  await downloadTo(source.url, archivePath, { httpsModule });

  const extractDir = join(binDir, "ffmpeg-extract");
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  extractArchive(archivePath, extractDir, spawnFn);

  const found = findBinary(extractDir, source.binary);

  if (!found) {
    rmSync(archivePath, { force: true });
    rmSync(extractDir, { recursive: true, force: true });
    throw new Error("Could not locate ffmpeg inside the downloaded archive.");
  }

  renameSync(found, dest);
  chmodSync(dest, 0o755);
  rmSync(archivePath, { force: true });
  rmSync(extractDir, { recursive: true, force: true });
  return dest;
}

// bsdtar (shipped with Windows 10+, macOS, and most Linux) extracts both
// .tar.xz and .zip, so a single `tar -xf` covers every platform we target.
function extractArchive(archivePath, destDir, spawnFn = spawnSync) {
  const result = spawnFn("tar", ["-xf", archivePath, "-C", destDir], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    const detail = result.stderr || result.error?.message || "unknown error";
    throw new Error(`Failed to extract ${archivePath}: ${detail}`);
  }
}

// Total size of lyt's managed binaries, for a `--setup`/status readout.
export function managedSize(env = process.env, platform = process.platform) {
  const binDir = lytBinDir(env, platform);

  if (!existsSync(binDir)) {
    return 0;
  }

  let total = 0;

  for (const entry of readdirSync(binDir)) {
    try {
      total += statSync(join(binDir, entry)).size;
    } catch {
      // ignore unreadable entries
    }
  }

  return total;
}
