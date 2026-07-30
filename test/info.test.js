import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { fetchInfo, parseInfo } from "../src/info.js";

const sample = JSON.stringify({
  id: "abc123",
  extractor_key: "Youtube",
  title: "Sample Video",
  uploader: "Sample Channel",
  duration: 125,
  is_live: false,
  thumbnail: "https://example.com/thumb.jpg",
  webpage_url: "https://www.youtube.com/watch?v=abc123",
  formats: [
    { format_id: "137", ext: "mp4", vcodec: "avc1", acodec: "none", height: 1080, fps: 30, filesize: 1048576 },
    { format_id: "136", ext: "mp4", vcodec: "avc1", acodec: "none", height: 720 },
    { format_id: "140", ext: "m4a", vcodec: "none", acodec: "mp4a", abr: 128, filesize_approx: 512000 },
    { format_id: "251", ext: "webm", vcodec: "none", acodec: "opus", abr: 70.5 },
    { format_id: "sb0", vcodec: "none", acodec: "none" },
  ],
});

test("parseInfo shapes metadata, sorted heights, and audio bitrates", () => {
  const info = parseInfo(sample);

  assert.equal(info.id, "abc123");
  assert.equal(info.extractor, "Youtube");
  assert.equal(info.title, "Sample Video");
  assert.equal(info.uploader, "Sample Channel");
  assert.equal(info.durationSeconds, 125);
  assert.equal(info.isLive, false);
  assert.equal(info.webpageUrl, "https://www.youtube.com/watch?v=abc123");
  assert.deepEqual(info.heights, [1080, 720]);
  assert.deepEqual(info.audioBitrates, [128, 71]);
  assert.equal(info.formats.length, 5);

  const video = info.formats.find((format) => format.formatId === "137");
  assert.equal(video.height, 1080);
  assert.equal(video.acodec, null);
  assert.equal(video.filesize, 1048576);

  const audio = info.formats.find((format) => format.formatId === "140");
  assert.equal(audio.abr, 128);
  assert.equal(audio.vcodec, null);
  assert.equal(audio.filesize, 512000);
});

test("parseInfo describes the first entry of a playlist dump", () => {
  const playlist = JSON.stringify({
    entries: [
      { id: "first", title: "First", duration: 30, formats: [{ vcodec: "vp9", acodec: "none", height: 480 }] },
    ],
  });

  const info = parseInfo(playlist);

  assert.equal(info.title, "First");
  assert.equal(info.id, "first");
  assert.deepEqual(info.heights, [480]);
});

test("parseInfo tolerates missing optional fields", () => {
  const info = parseInfo(JSON.stringify({ title: "Bare" }));

  assert.equal(info.title, "Bare");
  assert.equal(info.uploader, null);
  assert.equal(info.durationSeconds, null);
  assert.equal(info.isLive, false);
  assert.deepEqual(info.heights, []);
  assert.deepEqual(info.formats, []);
});

test("parseInfo reads live_status when is_live is absent", () => {
  const info = parseInfo(JSON.stringify({ title: "Stream", live_status: "is_live" }));
  assert.equal(info.isLive, true);
});

function fakeSpawn(stdout, code, onSpawn = () => {}) {
  return (command, args, options) => {
    onSpawn(command, args, options);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();

    setImmediate(() => {
      if (stdout) child.stdout.write(stdout);
      child.stdout.end();
      child.stderr.end();
      child.emit("close", code);
    });

    return child;
  };
}

test("fetchInfo parses successful yt-dlp output", async () => {
  const info = await fetchInfo("https://v", { spawnFn: fakeSpawn(sample, 0) });
  assert.equal(info.title, "Sample Video");
  assert.deepEqual(info.heights, [1080, 720]);
});

test("fetchInfo requests a JSON dump without downloading", async () => {
  let spawnedArgs;
  await fetchInfo("https://v", {
    spawnFn: fakeSpawn(sample, 0, (_command, args) => {
      spawnedArgs = args;
    }),
  });

  assert.ok(spawnedArgs.includes("-J"));
  assert.ok(spawnedArgs.includes("--no-playlist"));
  assert.equal(spawnedArgs[spawnedArgs.length - 2], "--");
  assert.equal(spawnedArgs[spawnedArgs.length - 1], "https://v");
});

test("fetchInfo rejects on a non-zero exit", async () => {
  await assert.rejects(
    fetchInfo("https://v", { spawnFn: fakeSpawn("", 1) }),
    /could not read media info/,
  );
});
