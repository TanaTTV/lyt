import test from "node:test";
import assert from "node:assert/strict";
import { createProgressRenderer, parseProgressLine } from "../src/progress.js";

test("parses a yt-dlp download progress line", () => {
  const info = parseProgressLine("[download]  42.3% of 4.20MiB at 1.50MiB/s ETA 00:02");

  assert.equal(info.percent, 42.3);
  assert.equal(info.speed, "1.50MiB/s");
  assert.equal(info.eta, "00:02");
});

test("parses a completed download line without eta", () => {
  const info = parseProgressLine("[download] 100% of 4.20MiB in 00:03");

  assert.equal(info.percent, 100);
  assert.equal(info.eta, undefined);
});

test("treats audio extraction as a convert stage at 100%", () => {
  const info = parseProgressLine("[ExtractAudio] Destination: downloads/Song [id].mp3");

  assert.equal(info.percent, 100);
  assert.equal(info.stage, "convert");
});

test("ignores non-progress lines", () => {
  assert.equal(parseProgressLine("[info] Downloading webpage"), null);
  assert.equal(parseProgressLine("WARNING: something"), null);
});

test("non-TTY renderer emits plain per-item lines and never ANSI escapes", () => {
  const written = [];
  const out = { isTTY: false, write: (chunk) => written.push(chunk) };
  const renderer = createProgressRenderer(["a", "b"], { out });

  renderer.update(0, parseProgressLine("[download]  50.0% of 1MiB at 1MiB/s ETA 00:01"));
  renderer.done(0, true);
  renderer.done(1, false);
  renderer.finish();

  const output = written.join("");
  assert.equal(output.includes("\x1B"), false);
  assert.match(output, /a: done/);
  assert.match(output, /b: failed/);
});

test("renderer ignores updates for out-of-range or finished items", () => {
  const out = { isTTY: false, write() {} };
  const renderer = createProgressRenderer(["only"], { out });

  assert.doesNotThrow(() => renderer.update(5, { percent: 10 }));
  renderer.done(0, true);
  assert.doesNotThrow(() => renderer.update(0, { percent: 50 }));
});
