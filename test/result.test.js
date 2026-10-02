import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  extractOutputMeta,
  extractOutputPath,
  outputCaptureArgs,
  resultEnvelope,
} from "../src/result.js";
import { runCommand } from "../src/cli.js";

test("builds an after-move print marker for exact final paths", () => {
  assert.deepEqual(outputCaptureArgs(), [
    "--print",
    "after_move:__LYT_FILE__:%(filepath)s",
    "--print",
    "after_move:__LYT_META__:%(.{id,title,extractor_key,webpage_url,duration,uploader})j",
  ]);
});

test("parses the per-item metadata marker and ignores other lines", () => {
  assert.equal(extractOutputMeta("[download] 50%"), null);
  assert.equal(extractOutputMeta("__LYT_META__:not json"), null);
  assert.deepEqual(
    extractOutputMeta('__LYT_META__:{"id":"293","title":"Flickermood","extractor_key":"Soundcloud","webpage_url":"https://soundcloud.com/forss/flickermood","duration":213.5}'),
    {
      id: "293",
      title: "Flickermood",
      extractor: "Soundcloud",
      webpageUrl: "https://soundcloud.com/forss/flickermood",
      durationSeconds: 213.5,
      uploader: null,
    },
  );
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
