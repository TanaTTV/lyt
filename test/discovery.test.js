import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  buildMediaPlan,
  inspectMedia,
  parseInspectPayload,
  parseSearchPayload,
  searchMedia,
} from "../src/discovery.js";

const metadata = {
  id: "abc123def45",
  title: "Safe sample",
  webpage_url: "https://www.youtube.com/watch?v=abc123def45",
  duration: 125,
  view_count: 4200,
  uploader: "Uploader",
  formats: [
    {
      format_id: "140",
      ext: "m4a",
      vcodec: "none",
      acodec: "mp4a.40.2",
      abr: 128,
      filesize: 2_000_000,
    },
    {
      format_id: "137",
      ext: "mp4",
      vcodec: "avc1",
      acodec: "none",
      height: 1080,
      width: 1920,
      tbr: 2500,
      filesize_approx: 30_000_000,
    },
    {
      format_id: "22",
      ext: "mp4",
      vcodec: "avc1",
      acodec: "mp4a",
      height: 720,
      width: 1280,
      tbr: 1200,
      filesize: 15_000_000,
    },
  ],
  subtitles: {
    en: [{ ext: "vtt" }, { ext: "srt" }],
  },
  automatic_captions: {
    es: [{ ext: "vtt" }],
  },
};

function fakeSpawn({ stdout = "", stderr = "", code = 0, inspect } = {}) {
  return (command, args, options) => {
    inspect?.({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();

    setImmediate(() => {
      if (stdout) child.stdout.write(stdout);
      if (stderr) child.stderr.write(stderr);
      child.stdout.end();
      child.stderr.end();
      child.emit("close", code);
    });
    return child;
  };
}

test("inspect normalizes metadata, formats, and caption sources", () => {
  const result = parseInspectPayload(metadata, {
    requestedUrl: "https://youtu.be/abc123def45",
    version: "0.test",
  });

  assert.equal(result.schema, "lyt.inspect.v1");
  assert.equal(result.media.title, "Safe sample");
  assert.equal(result.media.viewCount, 4200);
  assert.equal(result.formats[0].hasAudio, true);
  assert.equal(result.formats[1].sizeKind, "approximate");
  assert.deepEqual(result.captions.manual, [{
    language: "en",
    formats: ["srt", "vtt"],
    trackCount: 2,
  }]);
  assert.equal(result.captions.automatic[0].language, "es");
});

test("inspect uses a metadata-only yt-dlp invocation", async () => {
  let invocation;
  const result = await inspectMedia("https://youtu.be/abc123def45", {
    command: "safe-yt-dlp",
    version: "0.test",
    spawnFn: fakeSpawn({
      stdout: JSON.stringify(metadata),
      inspect: (value) => {
        invocation = value;
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(invocation.command, "safe-yt-dlp");
  assert.ok(invocation.args.includes("--skip-download"));
  assert.ok(invocation.args.includes("--no-playlist"));
  assert.deepEqual(invocation.args.slice(-2), ["--", "https://youtu.be/abc123def45"]);
  assert.equal(invocation.args.includes("-o"), false);
  assert.equal(invocation.options.stdio[0], "ignore");
});

test("inspect propagates a bounded yt-dlp failure", async () => {
  await assert.rejects(
    inspectMedia("https://example.test/video", {
      spawnFn: fakeSpawn({ stderr: "private failure detail", code: 3 }),
    }),
    (error) => error.exitCode === 3 && /private failure detail/.test(error.message),
  );
});

test("search returns stable result fields from a flat playlist", () => {
  const result = parseSearchPayload({
    entries: [
      {
        id: "abc123def45",
        title: "One",
        url: "abc123def45",
        duration: 60,
        uploader: "Creator",
      },
      null,
      {
        id: "xyz987uvw65",
        title: "Two",
        webpage_url: "https://example.test/two",
      },
    ],
  }, { query: "tutorial", limit: 2, version: "0.test" });

  assert.equal(result.schema, "lyt.search.v1");
  assert.equal(result.total, 2);
  assert.deepEqual(Object.keys(result.results[0]), [
    "id",
    "title",
    "url",
    "durationSeconds",
    "viewCount",
    "uploader",
    "channel",
    "thumbnail",
    "availability",
    "liveStatus",
  ]);
  assert.equal(
    result.results[0].url,
    "https://www.youtube.com/watch?v=abc123def45",
  );
  assert.equal(result.results[1].url, "https://example.test/two");
  assert.equal(result.results[0].viewCount, null);
  assert.equal(result.results[1].durationSeconds, null);
});

test("search uses ytsearch with a URL boundary and never downloads", async () => {
  let invocation;
  const result = await searchMedia("--exec=never", {
    limit: 3,
    command: "safe-yt-dlp",
    version: "0.test",
    spawnFn: fakeSpawn({
      stdout: JSON.stringify({ entries: [] }),
      inspect: (value) => {
        invocation = value;
      },
    }),
  });

  assert.equal(result.total, 0);
  assert.ok(invocation.args.includes("--flat-playlist"));
  assert.ok(invocation.args.includes("--skip-download"));
  assert.deepEqual(invocation.args.slice(-2), ["--", "ytsearch3:--exec=never"]);
  assert.equal(invocation.args.some((arg) => ["-o", "--output"].includes(arg)), false);
});

test("search rejects empty queries and unbounded result counts", async () => {
  await assert.rejects(searchMedia("", { spawnFn: fakeSpawn() }), /cannot be empty/);
  await assert.rejects(
    searchMedia("valid", { limit: 51, spawnFn: fakeSpawn() }),
    /integer from 1 to 50/,
  );
});

test("plan selects streams, estimates size, and exposes approval side effects", () => {
  const inspection = parseInspectPayload(metadata, {
    requestedUrl: metadata.webpage_url,
    version: "0.test",
  });
  const plan = buildMediaPlan(inspection, {
    options: {
      video: true,
      maxHeight: 1080,
      outputDir: "planned-output",
      template: "%(id)s.%(ext)s",
    },
    historyMatch: {
      matched: true,
      entry: {
        artifact: "lyt.artifact.v1:abc",
        files: ["C:/media/existing.mp4"],
        ts: "2026-07-23T00:00:00Z",
      },
    },
    tools: { ytDlp: true, ffmpeg: true },
  });

  assert.equal(plan.schema, "lyt.plan.v1");
  assert.deepEqual(plan.selection.formatIds, ["137", "140"]);
  assert.equal(plan.estimate.bytes, 32_000_000);
  assert.equal(plan.estimate.basis, "approximate");
  assert.equal(plan.requirements.find((tool) => tool.name === "ffmpeg").required, true);
  assert.equal(plan.history.matched, true);
  assert.equal(plan.recommendation, "skip");
  assert.equal(plan.sideEffects.performedByPlan.mediaDownloaded, false);
  assert.equal(plan.sideEffects.performedByPlan.filesWritten, false);
  assert.equal(plan.sideEffects.performedByPlan.toolsInstalled, false);
  assert.equal(plan.sideEffects.ifApproved.networkMediaDownload, true);
  assert.equal(plan.sideEffects.ifApproved.mayInstallMissingTools, true);
});

test("plan identifies missing required tools and keeps estimates honest", () => {
  const inspection = parseInspectPayload({
    ...metadata,
    formats: [{
      format_id: "audio",
      ext: "webm",
      vcodec: "none",
      acodec: "opus",
      abr: 96,
    }],
  }, { requestedUrl: metadata.webpage_url });

  const plan = buildMediaPlan(inspection, {
    options: { mp3: true, quality: "192K" },
    tools: { ytDlp: true, ffmpeg: false },
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.recommendation, "blocked");
  assert.equal(plan.estimate.bytes, null);
  assert.equal(plan.estimate.basis, "unavailable");
  assert.match(plan.estimate.note, /converted MP3 size may differ/);
});

test("video plans require ffmpeg even when yt-dlp reports a combined stream", () => {
  const inspection = parseInspectPayload({
    ...metadata,
    formats: [{
      format_id: "combined",
      ext: "mp4",
      vcodec: "h264",
      acodec: "aac",
      height: 720,
      filesize: 10_000,
    }],
  }, { requestedUrl: metadata.webpage_url });

  const plan = buildMediaPlan(inspection, {
    options: { video: true, maxHeight: 720, noDownload: true },
    tools: { ytDlp: true, ffmpeg: false },
  });

  assert.equal(
    plan.requirements.find((tool) => tool.name === "ffmpeg").required,
    true,
  );
  assert.equal(plan.ok, false);
  assert.equal(plan.recommendation, "blocked");
  assert.equal(plan.sideEffects.ifApproved.mayInstallMissingTools, false);
});
