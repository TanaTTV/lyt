import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  downloadTo,
  ffmpegSource,
  findBinary,
  findChecksum,
  lytBinDir,
  lytDataDir,
  ytDlpAsset,
} from "../src/bootstrap.js";

test("lytDataDir is platform-appropriate", () => {
  assert.equal(
    lytDataDir({ LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" }, "win32"),
    join("C:\\Users\\me\\AppData\\Local", "lyt"),
  );

  assert.equal(
    lytDataDir({ XDG_DATA_HOME: "/data" }, "linux"),
    join("/data", "lyt"),
  );

  assert.ok(lytDataDir({}, "darwin").endsWith(join("Application Support", "lyt")));
  assert.ok(lytBinDir({ XDG_DATA_HOME: "/data" }, "linux").endsWith(join("lyt", "bin")));
});

test("ytDlpAsset picks the right self-contained binary per platform", () => {
  assert.deepEqual(ytDlpAsset("win32", "x64"), { asset: "yt-dlp.exe", out: "yt-dlp.exe" });
  assert.deepEqual(ytDlpAsset("darwin", "arm64"), { asset: "yt-dlp_macos", out: "yt-dlp" });
  assert.deepEqual(ytDlpAsset("linux", "x64"), { asset: "yt-dlp_linux", out: "yt-dlp" });
  assert.deepEqual(ytDlpAsset("linux", "arm64"), {
    asset: "yt-dlp_linux_aarch64",
    out: "yt-dlp",
  });
});

test("ffmpegSource selects archive + source per platform", () => {
  assert.match(ffmpegSource("win32", "x64").url, /win64-gpl\.zip$/);
  assert.equal(ffmpegSource("win32", "x64").archive, "zip");

  assert.match(ffmpegSource("linux", "x64").url, /linux64-gpl\.tar\.xz$/);
  assert.match(ffmpegSource("linux", "arm64").url, /linuxarm64-gpl\.tar\.xz$/);

  assert.match(ffmpegSource("darwin", "arm64").url, /evermeet\.cx/);
});

test("findChecksum extracts the hash for a named asset", () => {
  const sums = [
    "aaaa000000000000000000000000000000000000000000000000000000000000  yt-dlp",
    "bbbb111111111111111111111111111111111111111111111111111111111111  yt-dlp_linux",
    "cccc222222222222222222222222222222222222222222222222222222222222 *yt-dlp.exe",
  ].join("\n");

  assert.equal(
    findChecksum(sums, "yt-dlp_linux"),
    "bbbb111111111111111111111111111111111111111111111111111111111111",
  );
  // Tolerates the binary-mode "*" marker before the filename.
  assert.equal(
    findChecksum(sums, "yt-dlp.exe"),
    "cccc222222222222222222222222222222222222222222222222222222222222",
  );
  assert.equal(findChecksum(sums, "missing"), null);
});

test("findBinary locates a file nested in an extracted tree", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-find-"));

  try {
    const nested = join(root, "ffmpeg-build", "bin");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "ffmpeg"), "binary");
    writeFileSync(join(root, "README.txt"), "noise");

    assert.equal(findBinary(root, "ffmpeg"), join(nested, "ffmpeg"));
    assert.equal(findBinary(root, "nope"), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("downloadTo follows redirects and writes the body", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lyt-dl-"));
  const dest = join(dir, "out.bin");

  // Fake https.get: first URL 302-redirects, second returns the payload.
  const httpsModule = {
    get(url, cb) {
      const res = new EventEmitter();

      if (url.includes("redirect")) {
        res.statusCode = 302;
        res.headers = { location: "https://cdn.example/final" };
        res.resume = () => {};
        queueMicrotask(() => cb(res));
      } else {
        res.statusCode = 200;
        res.headers = {};
        res.pipe = (file) => {
          file.write("hello-binary");
          file.end();
        };
        queueMicrotask(() => cb(res));
      }

      return new EventEmitter(); // request object; never errors here
    },
  };

  try {
    await downloadTo("https://example/redirect", dest, { httpsModule });
    const { readFileSync } = await import("node:fs");
    assert.equal(readFileSync(dest, "utf8"), "hello-binary");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("downloadTo rejects on a non-200/redirect status", async () => {
  const httpsModule = {
    get(url, cb) {
      const res = new EventEmitter();
      res.statusCode = 404;
      res.headers = {};
      res.resume = () => {};
      queueMicrotask(() => cb(res));
      return new EventEmitter();
    },
  };

  await assert.rejects(
    () => downloadTo("https://example/missing", "/tmp/never", { httpsModule }),
    /HTTP 404/,
  );
});
