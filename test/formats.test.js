import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { listFormats, parseFormats } from "../src/formats.js";

const sample = JSON.stringify({
  title: "Sample Video",
  formats: [
    { vcodec: "vp9", acodec: "none", height: 2160 },
    { vcodec: "avc1", acodec: "none", height: 1080 },
    { vcodec: "avc1", acodec: "none", height: 1080 },
    { vcodec: "avc1", acodec: "none", height: 720 },
    { vcodec: "none", acodec: "mp4a", abr: 128 },
    { vcodec: "none", acodec: "opus", abr: 70.5 },
    { vcodec: "none", acodec: "none" },
  ],
});

test("parses unique sorted heights and audio bitrates", () => {
  const formats = parseFormats(sample);

  assert.equal(formats.title, "Sample Video");
  assert.deepEqual(formats.heights, [2160, 1080, 720]);
  assert.deepEqual(formats.audioBitrates, [128, 71]);
});

test("handles a playlist dump by using the first entry", () => {
  const playlist = JSON.stringify({
    entries: [
      { title: "First", formats: [{ vcodec: "vp9", acodec: "none", height: 480 }] },
    ],
  });

  const formats = parseFormats(playlist);

  assert.equal(formats.title, "First");
  assert.deepEqual(formats.heights, [480]);
});

test("tolerates missing formats array", () => {
  const formats = parseFormats(JSON.stringify({ title: "Empty" }));

  assert.deepEqual(formats.heights, []);
  assert.deepEqual(formats.audioBitrates, []);
});

function fakeSpawn(stdout, code, onSpawn = () => {}) {
  return (command, args, options) => {
    onSpawn(command, args, options);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();

    setImmediate(() => {
      if (stdout) {
        child.stdout.write(stdout);
      }
      child.stdout.end();
      child.stderr.end();
      child.emit("close", code);
    });

    return child;
  };
}

test("listFormats parses successful yt-dlp output", async () => {
  const formats = await listFormats("https://v", { spawnFn: fakeSpawn(sample, 0) });

  assert.deepEqual(formats.heights, [2160, 1080, 720]);
});

test("listFormats enables the configured JavaScript runtime", async () => {
  let spawnedArgs;

  await listFormats("https://v", {
    runtimeArgs: ["--js-runtimes", "node:/usr/bin/node"],
    spawnFn: fakeSpawn(sample, 0, (_command, args) => {
      spawnedArgs = args;
    }),
  });

  assert.deepEqual(
    spawnedArgs.slice(
      spawnedArgs.indexOf("--js-runtimes"),
      spawnedArgs.indexOf("--js-runtimes") + 2,
    ),
    ["--js-runtimes", "node:/usr/bin/node"],
  );
});

test("listFormats rejects on a non-zero exit", async () => {
  await assert.rejects(
    listFormats("https://v", { spawnFn: fakeSpawn("", 1) }),
    /could not read formats/,
  );
});
