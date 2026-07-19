import test from "node:test";
import assert from "node:assert/strict";
import { resolveExecutableOnPath } from "../src/executables.js";

test("executable lookup ignores the current directory and relative PATH entries", () => {
  const checked = [];
  const resolved = resolveExecutableOnPath("yt-dlp", {
    platform: "linux",
    env: { PATH: ":.:tools:/trusted/bin" },
    canExecute(file) {
      checked.push(file);
      return file === "/trusted/bin/yt-dlp";
    },
  });

  assert.equal(resolved, "/trusted/bin/yt-dlp");
  assert.deepEqual(checked, ["/trusted/bin/yt-dlp"]);
});

test("Windows lookup applies PATHEXT only to absolute PATH entries", () => {
  const resolved = resolveExecutableOnPath("ffmpeg", {
    platform: "win32",
    env: { PATH: "relative;C:\\Trusted", PATHEXT: ".EXE;.CMD" },
    canExecute: (file) => file === "C:\\Trusted\\ffmpeg.EXE",
  });

  assert.equal(resolved, "C:\\Trusted\\ffmpeg.EXE");
});

test("lookup rejects relative commands that already contain separators", () => {
  assert.equal(resolveExecutableOnPath(".\\yt-dlp.exe", {
    platform: "win32",
    env: { PATH: "C:\\Trusted" },
    canExecute: () => true,
  }), null);
});
