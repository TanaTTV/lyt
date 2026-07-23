import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checksumForAsset,
  fetchYtDlpChecksums,
  readBounded,
  withInstallLock,
  WINDOWS_FFMPEG_ARCHIVE_EXECUTABLES,
  YT_DLP_CHECKSUM_ASSETS,
  ytDlpReleaseAsset,
} from "../src/bootstrap.js";

test("uses the current yt-dlp checksum manifest name with a legacy fallback", () => {
  assert.deepEqual(YT_DLP_CHECKSUM_ASSETS, ["SHA2-256SUMS", "SHA256SUMS"]);
});

test("the managed Windows FFmpeg archive installs both media tools", () => {
  assert.deepEqual(WINDOWS_FFMPEG_ARCHIVE_EXECUTABLES, [
    "ffmpeg.exe",
    "ffprobe.exe",
  ]);
});
test("fetches the current checksum manifest first", async () => {
  const urls = [];
  const manifest = await fetchYtDlpChecksums(async (url) => {
    urls.push(url);
    return { ok: true, status: 200, text: async () => "abc  yt-dlp.exe\n" };
  });

  assert.equal(manifest, "abc  yt-dlp.exe\n");
  assert.match(urls[0], /SHA2-256SUMS$/);
  assert.equal(urls.length, 1);
});

test("falls back to the legacy checksum filename", async () => {
  const urls = [];
  const manifest = await fetchYtDlpChecksums(async (url) => {
    urls.push(url);
    return url.endsWith("SHA256SUMS")
      ? { ok: true, status: 200, text: async () => "abc  yt-dlp.exe\n" }
      : { ok: false, status: 404 };
  });

  assert.equal(manifest, "abc  yt-dlp.exe\n");
  assert.equal(urls.length, 2);
});

test("selects standalone release assets for common platforms", () => {
  assert.equal(ytDlpReleaseAsset("win32", "x64"), "yt-dlp.exe");
  assert.equal(ytDlpReleaseAsset("win32", "arm64"), "yt-dlp_arm64.exe");
  assert.equal(ytDlpReleaseAsset("darwin", "arm64"), "yt-dlp_macos");
  assert.equal(ytDlpReleaseAsset("linux", "x64"), "yt-dlp_linux");
  assert.equal(ytDlpReleaseAsset("linux", "arm64"), "yt-dlp_linux_aarch64");
});

test("parses an exact checksum entry", () => {
  const hash = "a".repeat(64);
  assert.equal(checksumForAsset(`${hash}  yt-dlp.exe\n`, "yt-dlp.exe"), hash);
  assert.equal(checksumForAsset(`${hash}  yt-dlp_arm64.exe\n`, "yt-dlp.exe"), null);
});

test("bounded reads cancel a streaming response as soon as the limit is exceeded", async () => {
  let cancelled = false;
  let pulls = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array(6));
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = { body, headers: { get: () => null } };

  await assert.rejects(
    readBounded(response, 10, "test payload"),
    /exceeded the 10-byte safety limit/,
  );
  assert.equal(pulls, 2);
  assert.equal(cancelled, true);
});

test("stale install locks from dead processes are recovered automatically", async () => {
  const directory = mkdtempSync(join(tmpdir(), "lyt-install-lock-"));
  const lockPath = join(directory, "yt-dlp.install.lock");

  try {
    writeFileSync(lockPath, JSON.stringify({ pid: 2_147_483_647 }));
    const result = await withInstallLock("yt-dlp", async () => {
      assert.equal(existsSync(lockPath), true);
      return "installed";
    }, {
      directory,
      waitMs: 100,
      pollMs: 5,
    });

    assert.equal(result, "installed");
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
