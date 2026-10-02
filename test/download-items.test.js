import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { buildTasks, downloadUrls, needsFfmpeg } from "../src/download.js";
import { matchHistory } from "../src/history.js";
import { MAX_DOWNLOADS_REACHED, runCommand } from "../src/process.js";
import { normalizeOptions } from "../src/ytDlp.js";

const TOOLS = { ytDlpCommand: "fixture", ffmpegPath: "ffmpeg-fixture" };

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "lyt-items-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function songTarget(overrides = {}) {
  return {
    url: "ytsearch5:A - Song audio",
    fallbackUrl: "ytsearch1:A - Song audio",
    matchFilter: "duration >? 190 & duration <? 210",
    label: "A - Song",
    base: "Mix/01 - A - Song",
    template: "Mix/01 - A - Song.%(ext)s",
    metadata: { artist: "A", title: "Song", album: null, track: null },
    cover: null,
    spotifyTrackId: "6OmhkSOpvYBokMKQxpIGx2",
    source: { type: "spotify", collection: "Mix", position: 1, artist: "A", title: "Song", durationSeconds: 200 },
    ...overrides,
  };
}

test("a search with no result of the right length falls back to the top result", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const calls = [];
    const file = join(dir, "Mix", "01 - A - Song.mp3");
    const covers = [];
    const options = normalizeOptions({ outputDir: dir, mp3: true, history: false, json: true });
    const { results, failures, resultFor } = await downloadUrls([songTarget()], options, TOOLS, {
      execute: async (command, args, runOptions) => {
        calls.push({ url: args.at(-1), okCodes: runOptions.okCodes });
        return calls.length === 1
          ? { files: [], items: [], sizeLimited: false }
          : { files: [file], items: [{ id: "abc12345678", title: "Song (Official Audio)", extractor: "Youtube", webpageUrl: "https://www.youtube.com/watch?v=abc12345678", durationSeconds: 201 }] };
      },
      lookupCover: async (id) => `https://covers.example/${id}.jpg`,
      embed: async (target, url) => covers.push({ target, url }),
    });

    assert.deepEqual(calls, [
      { url: "ytsearch5:A - Song audio", okCodes: [0, MAX_DOWNLOADS_REACHED] },
      { url: "ytsearch1:A - Song audio", okCodes: undefined },
    ]);
    assert.equal(failures.length, 0);
    assert.equal(results[0].status, "downloaded");
    assert.equal(results[0].videoId, "abc12345678");
    assert.equal(results[0].source.position, 1);
    assert.deepEqual(results[0].match, {
      id: "abc12345678",
      title: "Song (Official Audio)",
      url: "https://www.youtube.com/watch?v=abc12345678",
      durationSeconds: 201,
    });
    assert.deepEqual(covers, [{ target: file, url: "https://covers.example/6OmhkSOpvYBokMKQxpIGx2.jpg" }]);
    assert.equal(resultFor.size, 1);
  } finally {
    cleanup();
  }
});

test("cover art problems are warnings, not failures", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const options = normalizeOptions({ outputDir: dir, mp3: true, history: false, json: true });
    const { failures, results } = await downloadUrls([songTarget({ cover: "https://covers.example/x.jpg" })], options, TOOLS, {
      execute: async () => ({ files: [join(dir, "song.mp3")], items: [] }),
      embed: async () => {
        throw new Error("network down");
      },
    });
    assert.equal(failures.length, 0);
    assert.equal(results[0].status, "downloaded");
  } finally {
    cleanup();
  }
});

test("subtitle files saved next to the media are reported", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const media = join(dir, "Talk [abc12345678].mp4");
    writeFileSync(media, "");
    writeFileSync(join(dir, "Talk [abc12345678].en.srt"), "");
    writeFileSync(join(dir, "Other [zzz].en.srt"), "");
    const options = normalizeOptions({ outputDir: dir, video: true, subs: true, history: false, json: true });
    const { results } = await downloadUrls(["https://youtu.be/abc12345678"], options, TOOLS, {
      execute: async () => ({ files: [media], items: [] }),
    });
    assert.deepEqual(results[0].files, [media, join(dir, "Talk [abc12345678].en.srt")]);
  } finally {
    cleanup();
  }
});

test("results keep input order with mixed URLs and expanded targets", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const options = normalizeOptions({ outputDir: dir, history: false, json: true, jobs: 3 });
    const items = ["https://youtu.be/aaaaaaaaaaa", songTarget({ matchFilter: null, fallbackUrl: null }), "https://soundcloud.com/a/b"];
    let finished = 0;
    const { results } = await downloadUrls(items, options, TOOLS, {
      execute: async (command, args) => {
        const url = args.at(-1);
        // The first item finishes last.
        await new Promise((resolve) => setTimeout(resolve, url.includes("youtu") ? 30 : 1));
        finished += 1;
        return { files: [join(dir, `${finished}.m4a`)], items: [] };
      },
      lookupCover: async () => null,
    });
    assert.ok(results.every((result) => result.status === "downloaded"));
    assert.equal(results[0].files[0], join(dir, "3.m4a"));
    assert.deepEqual(results.map((result) => result.url), [
      "https://youtu.be/aaaaaaaaaaa",
      "ytsearch5:A - Song audio",
      "https://soundcloud.com/a/b",
    ]);
  } finally {
    cleanup();
  }
});

test("expanded targets get their own template, filter, and tags; others do not", () => {
  const options = normalizeOptions({ outputDir: "out", mp3: true, embedThumbnail: true });
  const [plain, song] = buildTasks(["https://youtu.be/aaaaaaaaaaa", songTarget()], options, { ffmpegPath: null });

  assert.ok(plain.args.includes("--embed-thumbnail"));
  assert.ok(!plain.args.includes("--match-filter"));
  assert.ok(!plain.args.includes("--parse-metadata"));

  assert.ok(!song.args.includes("--embed-thumbnail"));
  assert.equal(song.args[song.args.indexOf("--match-filter") + 1], "duration >? 190 & duration <? 210");
  assert.equal(song.args[song.args.indexOf("--max-downloads") + 1], "1");
  assert.ok(song.args.includes("@A:^@(?P<meta_artist>.+)$"));
  assert.ok(song.fallbackArgs.includes("ytsearch1:A - Song audio"));
  assert.ok(!song.fallbackArgs.includes("--match-filter"));
});

test("tagging Spotify songs and subtitle/SponsorBlock work require ffmpeg", () => {
  const base = normalizeOptions({});
  assert.equal(needsFfmpeg(base), false);
  assert.equal(needsFfmpeg(base, [songTarget()]), true);
  assert.equal(needsFfmpeg(normalizeOptions({ subs: true })), true);
  assert.equal(needsFfmpeg(normalizeOptions({ sponsorblock: true })), true);
});

test("history matches non-YouTube links by normalized URL and keeps collections fresh", () => {
  const entries = [
    { id: null, url: "https://soundcloud.com/forss/flickermood?si=1", files: [], artifact: "A" },
    { id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ", files: [], artifact: "A" },
    { id: null, url: "https://on.soundcloud.com/x", webpageUrl: "https://soundcloud.com/forss/other", files: [], artifact: "A" },
    { id: null, url: "https://www.youtube.com/playlist?list=PL1", files: [], artifact: "A" },
  ];
  const urls = [
    "https://m.soundcloud.com/forss/flickermood",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://soundcloud.com/forss/other?utm_source=x",
    "https://www.youtube.com/playlist?list=PL1",
    "https://vimeo.com/1",
  ];
  const { fresh, skipped, matches } = matchHistory(urls, entries, () => true, "A");

  assert.deepEqual(skipped, urls.slice(0, 3));
  assert.deepEqual(fresh, urls.slice(3));
  assert.equal(matches.get(urls[2]).url, "https://on.soundcloud.com/x");
  assert.deepEqual(matchHistory(urls, entries, () => true, "B").skipped, []);
});

test("process runner captures metadata, accepts allowed exit codes, and reports signals", async () => {
  const fake = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    return child;
  };

  let child = fake();
  const lines = [];
  let pending = runCommand("fixture", [], { onLine: (line) => lines.push(line), spawnFn: () => child, okCodes: [0, 101] });
  child.stdout.write("__LYT_FILE__:/tmp/a.mp3\n");
  child.stdout.write('__LYT_META__:{"id": "x", "title": "T", "extractor_key": "Youtube"}\n');
  child.stdout.write("[download] 100%\n");
  setImmediate(() => child.emit("close", 101, null));
  const outcome = await pending;
  assert.equal(outcome.files.length, 1);
  assert.equal(outcome.items[0].title, "T");
  assert.deepEqual(lines, ["[download] 100%"]);

  child = fake();
  pending = runCommand("fixture", [], { quiet: true, spawnFn: () => child });
  setImmediate(() => child.emit("close", null, "SIGINT"));
  await assert.rejects(pending, (error) => /was stopped \(SIGINT\)/.test(error.message) && error.exitCode === 1);
});

test("a subtitle failure saves the media without subtitles and warns", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const media = join(dir, "Talk [abc12345678].mp3");
    const options = normalizeOptions({ outputDir: dir, mp3: true, subs: true, history: false, json: true });
    const seen = [];
    const { results, failures } = await downloadUrls(["https://youtu.be/abc12345678"], options, TOOLS, {
      execute: async (command, args) => {
        seen.push(args.includes("--write-subs"));
        if (args.includes("--write-subs")) {
          throw new Error("fixture exited with code 1\nERROR: Unable to download video subtitles for 'en-de': HTTP Error 429: Too Many Requests");
        }
        return { files: [media], items: [] };
      },
    });
    assert.deepEqual(seen, [true, false]);
    assert.equal(failures.length, 0);
    assert.equal(results[0].status, "downloaded");
    assert.match(results[0].warning, /Subtitles could not be downloaded: Unable to download video subtitles for 'en-de': HTTP Error 429/);
  } finally {
    cleanup();
  }
});

test("non-subtitle failures are not retried", async () => {
  const options = normalizeOptions({ outputDir: tmpdir(), subs: true, history: false, json: true });
  let calls = 0;
  const { failures } = await downloadUrls(["https://youtu.be/abc12345678"], options, TOOLS, {
    execute: async () => {
      calls += 1;
      throw new Error("ERROR: Video unavailable");
    },
  });
  assert.equal(calls, 1);
  assert.equal(failures.length, 1);
});
