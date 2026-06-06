import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { promptForJob } from "../src/interactive.js";

function scripted(answers) {
  const input = new PassThrough();
  const output = new PassThrough();
  const queue = [...answers];
  let buffer = "";

  // Reply only when the program is actually waiting for input, i.e. it just
  // wrote a prompt ending in ": ". Menu lines (ending in newline) accumulate
  // without consuming an answer, so the picker's output doesn't desync us.
  output.on("data", (chunk) => {
    buffer += chunk.toString();

    if (buffer.endsWith(": ") && queue.length > 0) {
      buffer = "";
      const answer = queue.shift();
      setImmediate(() => input.write(`${answer}\n`));
    }
  });

  return { input, output };
}

test("collects a multi-url mp3 job from prompts", async () => {
  const { input, output } = scripted([
    "https://a  https://b",
    "audio",
    "mp3",
    "320K",
    "music",
    "4",
  ]);

  const job = await promptForJob({ input, output });

  assert.deepEqual(job.urls, ["https://a", "https://b"]);
  assert.equal(job.options.video, false);
  assert.equal(job.options.mp3, true);
  assert.equal(job.options.quality, "320K");
  assert.equal(job.options.outputDir, "music");
  assert.equal(job.options.jobs, "4");
});

test("collects a video job with a quality preset and skips mp3 prompts", async () => {
  const { input, output } = scripted(["https://v", "video", "1080p", "clips"]);

  const job = await promptForJob({ input, output });

  assert.deepEqual(job.urls, ["https://v"]);
  assert.equal(job.options.video, true);
  assert.equal(job.options.maxHeight, "1080p");
  assert.equal(job.options.mp3, undefined);
  assert.equal(job.options.outputDir, "clips");
});

test("video 'best' quality leaves maxHeight unset", async () => {
  const { input, output } = scripted(["https://v", "video", "best", "downloads"]);

  const job = await promptForJob({ input, output });

  assert.equal(job.options.video, true);
  assert.equal(job.options.maxHeight, undefined);
});

test("lists real qualities and picks one by number", async () => {
  const { input, output } = scripted([
    "https://v",
    "video",
    "y", // List available qualities?
    "2", // pick the second listed height
    "downloads",
  ]);

  const fetchFormats = async () => ({
    title: "Demo",
    heights: [2160, 1080, 720],
    audioBitrates: [128],
  });

  const job = await promptForJob({ input, output, fetchFormats });

  assert.equal(job.options.video, true);
  assert.equal(job.options.maxHeight, "1080");
});

test("falls back to manual prompt when format lookup fails", async () => {
  const { input, output } = scripted([
    "https://v",
    "video",
    "y", // try listing
    "4k", // manual fallback answer
    "downloads",
  ]);

  const fetchFormats = async () => {
    throw new Error("yt-dlp not installed");
  };

  const job = await promptForJob({ input, output, fetchFormats });

  assert.equal(job.options.maxHeight, "4k");
});

test("defaults the type prompt to video when invoked from yt4", async () => {
  const { input, output } = scripted(["https://v", "", "best", "downloads"]);

  const job = await promptForJob({ input, output, defaults: { video: true } });

  assert.equal(job.options.video, true);
  assert.equal(job.options.maxHeight, undefined);
});

test("uses defaults when answers are blank and skips mp3/jobs prompts", async () => {
  const { input, output } = scripted(["https://only", "", "", ""]);

  const job = await promptForJob({ input, output });

  assert.deepEqual(job.urls, ["https://only"]);
  assert.equal(job.options.video, false);
  assert.equal(job.options.mp3, false);
  assert.equal(job.options.quality, undefined);
  assert.equal(job.options.outputDir, "downloads");
  assert.equal(job.options.jobs, undefined);
});

test("returns null when no url is entered", async () => {
  const { input, output } = scripted([""]);

  const job = await promptForJob({ input, output });

  assert.equal(job, null);
});
