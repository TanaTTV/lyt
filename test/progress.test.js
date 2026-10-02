import test from "node:test";
import assert from "node:assert/strict";
import { createProgressRenderer, formatBar, parseProgressLine } from "../src/progress.js";
import { ANSI, stripAnsi } from "../src/ui.js";

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

test("parses a destination line so the bar can show the filename", () => {
  const info = parseProgressLine("[download] Destination: downloads/Song [id].webm");

  assert.equal(info.destination, "downloads/Song [id].webm");
});

test("formatBar uses ASCII by default and unicode blocks when asked", () => {
  const ascii = formatBar({ label: "abc", percent: 50, detail: "1MiB/s" });
  assert.match(ascii, /#+\-+/);
  assert.match(ascii, / 50%/);
  assert.equal(ascii.includes("█"), false);

  const blocks = formatBar({ label: "abc", percent: 50, detail: "1MiB/s" }, { unicode: true });
  assert.match(blocks, /█+░+/);
});

test("formatBar colors the fill and status words when color is on", () => {
  const done = formatBar({ label: "abc", percent: 100, detail: "done" }, { color: true });
  assert.equal(done.includes(ANSI.green), true);
  assert.equal(stripAnsi(done).includes("done"), true);

  const failed = formatBar({ label: "abc", percent: 10, detail: "failed" }, { color: true });
  assert.equal(failed.includes(ANSI.red), true);
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

test("TTY single-item renderer rewrites one line in place", () => {
  const written = [];
  const out = { isTTY: true, write: (chunk) => written.push(chunk) };
  const renderer = createProgressRenderer(["abc123"], {
    out,
    color: false,
    unicode: false,
  });

  renderer.update(0, { destination: "downloads/Song [abc123].webm" });
  renderer.update(0, { percent: 40, speed: "1MiB/s", eta: "00:03" });
  renderer.done(0, true);

  const output = written.join("");
  assert.equal(output.includes("\x1B["), true);
  assert.match(output, /\r/);
  assert.match(stripAnsi(output), /Song \[abc123\]\.webm/);
  assert.match(stripAnsi(output), /done/);
});

test("TTY renderer notes print above an in-place bar", () => {
  const written = [];
  const out = { isTTY: true, write: (chunk) => written.push(chunk) };
  const renderer = createProgressRenderer(["only"], {
    out,
    color: false,
    unicode: false,
  });

  renderer.note("[youtube] Downloading webpage");
  renderer.update(0, { percent: 10, speed: "2MiB/s" });

  const output = written.join("");
  assert.match(output, /\[youtube\] Downloading webpage\n/);
  assert.match(output, /\[#+-+\]/);
});
