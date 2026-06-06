import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { promptForJob } from "../src/interactive.js";

function scripted(answers) {
  const input = new PassThrough();
  const output = new PassThrough();
  const queue = [...answers];

  // Feed one answer per prompt: readline/promises only delivers a line while a
  // question() is actively listening, so we reply each time it writes a prompt.
  output.on("data", () => {
    if (queue.length === 0) {
      return;
    }

    const answer = queue.shift();
    setImmediate(() => input.write(`${answer}\n`));
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

test("collects a video job and skips the mp3 prompts", async () => {
  const { input, output } = scripted(["https://v", "video", "1080", "clips"]);

  const job = await promptForJob({ input, output });

  assert.deepEqual(job.urls, ["https://v"]);
  assert.equal(job.options.video, true);
  assert.equal(job.options.maxHeight, "1080");
  assert.equal(job.options.mp3, undefined);
  assert.equal(job.options.outputDir, "clips");
});

test("defaults the type prompt to video when invoked from yt4", async () => {
  const { input, output } = scripted(["https://v", "", "", "downloads"]);

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
