import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  extractOutputPath,
  extractSubtitlePaths,
  outputCaptureArgs,
  subtitleCaptureArgs,
  resultEnvelope,
} from "../src/result.js";
import { runCommand } from "../src/cli.js";

test("builds an after-move print marker for exact final paths", () => {
  assert.deepEqual(outputCaptureArgs(), [
    "--print",
    "after_move:__LYT_FILE__:%(filepath)s",
  ]);
});

test("captures exact subtitle sidecar paths from yt-dlp's final info", () => {
  assert.deepEqual(subtitleCaptureArgs(), [
    "--print",
    "after_move:__LYT_SUBTITLES__:%(requested_subtitles)j",
  ]);
  assert.deepEqual(
    extractSubtitlePaths(
      '__LYT_SUBTITLES__:{"en":{"ext":"vtt","filepath":"downloads/title.en.vtt"}}',
      "C:/work",
    ),
    [resolve("C:/work", "downloads/title.en.vtt")],
  );
  assert.equal(extractSubtitlePaths("[download] 50%"), null);
});

test("extracts and resolves final output paths while ignoring other lines", () => {
  assert.equal(extractOutputPath("[download] 50%"), null);
  assert.equal(
    extractOutputPath("__LYT_FILE__:downloads/song.mp3", "C:/work"),
    resolve("C:/work", "downloads/song.mp3"),
  );
});

test("result envelopes expose a stable versioned schema", () => {
  assert.deepEqual(resultEnvelope({
    command: "download",
    ok: true,
    results: [{ status: "downloaded" }],
    version: "0.7.0",
  }), {
    schema: "lyt.result.v1",
    version: "0.7.0",
    command: "download",
    ok: true,
    results: [{ status: "downloaded" }],
  });
});

test("command execution captures final paths without leaking the marker", async () => {
  const script = "console.log('__LYT_FILE__:downloads/final.mp3')";
  const outcome = await runCommand(process.execPath, ["-e", script], {
    quiet: true,
    cwd: "C:/work",
  });

  assert.deepEqual(outcome.files, [resolve("C:/work", "downloads/final.mp3")]);
});
