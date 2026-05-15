import test from "node:test";
import assert from "node:assert/strict";
import {
  buildYtDlpArgs,
  normalizeOptions,
  parseArgs,
} from "../src/ytDlp.js";

test("defaults to fast native audio without conversion", () => {
  const options = normalizeOptions();
  const args = buildYtDlpArgs("https://youtube.test/video", options);

  assert.equal(options.mp3, false);
  assert.deepEqual(args.slice(0, 2), ["--newline", "--no-warnings"]);
  assert.ok(args.includes("bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio"));
  assert.ok(args.includes("--concurrent-fragments"));
  assert.ok(args.includes("--no-playlist"));
  assert.equal(args.includes("-x"), false);
});

test("mp3 mode adds extraction and audio quality flags", () => {
  const options = normalizeOptions({ mp3: true, quality: "128k" });
  const args = buildYtDlpArgs("https://youtube.test/video", options);

  assert.ok(args.includes("-x"));
  assert.ok(args.includes("--audio-format"));
  assert.ok(args.includes("mp3"));
  assert.ok(args.includes("--audio-quality"));
  assert.ok(args.includes("128K"));
});

test("parses multiple urls and speed options", () => {
  const parsed = parseArgs([
    "--mp3",
    "--quality",
    "192K",
    "--fragments",
    "16",
    "--jobs",
    "3",
    "one",
    "two",
  ]);
  const options = normalizeOptions(parsed.options);

  assert.deepEqual(parsed.urls, ["one", "two"]);
  assert.equal(options.mp3, true);
  assert.equal(options.fragments, 16);
  assert.equal(options.jobs, 3);
});
