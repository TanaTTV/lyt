import test from "node:test";
import assert from "node:assert/strict";
import {
  checksumForAsset,
  fetchYtDlpChecksums,
  YT_DLP_CHECKSUM_ASSETS,
  ytDlpReleaseAsset,
} from "../src/bootstrap.js";

test("uses the current yt-dlp checksum manifest name with a legacy fallback", () => {
  assert.deepEqual(YT_DLP_CHECKSUM_ASSETS, ["SHA2-256SUMS", "SHA256SUMS"]);
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
