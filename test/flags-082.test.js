import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildCapabilities, OPTIONS } from "../src/capabilities.js";
import { readBatchFiles, summaryLine } from "../src/cli.js";
import { configToOptions, displayConfigValue, validateConfigValue } from "../src/config.js";
import { checkNetwork } from "../src/doctor.js";
import { coverArgs } from "../src/cover.js";
import { spotifyInfo } from "../src/commands/info.js";
import {
  buildYtDlpArgs,
  normalizeOptions,
  parseArgs,
  PLAYLIST_OUTPUT_TEMPLATE,
  VALUE_OPTIONS,
} from "../src/ytDlp.js";

const LYT = fileURLToPath(new URL("../bin/lyt.js", import.meta.url));
const argsFor = (raw, url = "https://youtu.be/dQw4w9WgXcQ") =>
  buildYtDlpArgs(url, normalizeOptions(parseArgs([...raw, url]).options), { runtimeArgs: [] });
const valueAfter = (args, flag) => args[args.indexOf(flag) + 1];

test("subtitle flags write, convert, and (in video mode) embed subtitles", () => {
  const audio = argsFor(["--subs"]);
  assert.ok(audio.includes("--write-subs") && audio.includes("--write-auto-subs"));
  assert.equal(valueAfter(audio, "--sub-langs"), "en");
  assert.equal(valueAfter(audio, "--convert-subs"), "srt");
  assert.ok(!audio.includes("--embed-subs"));

  const video = argsFor(["--video", "--embed-subs", "--sub-langs", "de,en"]);
  assert.equal(valueAfter(video, "--sub-langs"), "de,en");
  assert.ok(video.includes("--embed-subs"));

  assert.ok(!argsFor(["--subs", "--no-subs"]).includes("--write-subs"));
  assert.throws(() => normalizeOptions({ subLangs: "en; rm -rf" }), /Invalid --sub-langs/);
});

test("SponsorBlock, cookies, rate limit, and retries pass through", () => {
  const args = argsFor([
    "--sponsorblock",
    "--cookies-from-browser", "firefox",
    "--cookies", "cookies.txt",
    "-r", "2M/s",
    "--retries", "3",
  ]);
  assert.equal(valueAfter(args, "--sponsorblock-remove"), "sponsor,selfpromo,interaction");
  assert.equal(valueAfter(args, "--cookies-from-browser"), "firefox");
  assert.equal(valueAfter(args, "--cookies"), "cookies.txt");
  assert.equal(valueAfter(args, "--limit-rate"), "2M");
  assert.equal(valueAfter(args, "--retries"), "3");
  assert.equal(valueAfter(args, "--fragment-retries"), "3");
  assert.ok(args.indexOf("--cookies") < args.indexOf("--"));

  assert.throws(() => normalizeOptions({ limitRate: "fast" }), /Invalid --limit-rate/);
  assert.throws(() => normalizeOptions({ retries: "500" }), /Invalid --retries/);
  assert.equal(normalizeOptions({ retries: "infinite" }).retries, "infinite");
});

test("audio cover art is cropped square; video thumbnails are left alone", () => {
  const audio = argsFor(["--mp3", "--embed-thumbnail"]);
  assert.equal(valueAfter(audio, "--convert-thumbnails"), "jpg");
  assert.match(audio.find((arg) => arg.startsWith("ThumbnailsConvertor")), /crop=/);

  const video = argsFor(["--video", "--embed-thumbnail"]);
  assert.ok(!video.includes("--convert-thumbnails"));
});

test("--playlist saves collections into a numbered folder unless a template is set", () => {
  const playlist = "https://www.youtube.com/playlist?list=PL123";
  const out = (args) => valueAfter(args, "-o");

  assert.equal(out(argsFor(["--playlist", "-o", "dl"], playlist)), join("dl", PLAYLIST_OUTPUT_TEMPLATE));
  assert.equal(out(argsFor(["--playlist", "-o", "dl"], "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1")), join("dl", PLAYLIST_OUTPUT_TEMPLATE));
  assert.equal(out(argsFor(["--playlist", "-o", "dl"])), join("dl", "%(title).180B [%(id)s].%(ext)s"));
  assert.equal(out(argsFor(["--playlist", "-o", "dl", "--template", "%(id)s.%(ext)s"], playlist)), join("dl", "%(id)s.%(ext)s"));
});

test("Spotify tag values are literal even with colons, percent signs, and one word", () => {
  const args = buildYtDlpArgs("ytsearch1:x", normalizeOptions({}), { runtimeArgs: [] });
  assert.ok(!args.includes("--parse-metadata"));

  const tagged = buildYtDlpArgs(
    "ytsearch1:x",
    { ...normalizeOptions({}), metadata: { artist: "AC/DC", title: "Live: 100%", album: null, track: 3 } },
    { runtimeArgs: [] },
  );
  const values = tagged.filter((_, index) => tagged[index - 1] === "--parse-metadata");
  assert.deepEqual(values, [
    "@AC/DC:^@(?P<meta_artist>.+)$",
    "@Live\\: 100%%:^@(?P<meta_title>.+)$",
    "@3:^@(?P<meta_track>.+)$",
  ]);
  assert.ok(tagged.includes("--embed-metadata"));
});

test("every new value flag is known to URL dedupe and advertised to agents", () => {
  for (const flag of ["--sub-langs", "--cookies-from-browser", "--cookies", "--limit-rate", "-r", "--retries", "--batch-file", "-a"]) {
    assert.ok(VALUE_OPTIONS.has(flag), flag);
  }
  const advertised = new Set(OPTIONS.map((option) => option.flag));
  for (const flag of ["--subs", "--embed-subs", "--sponsorblock", "--cookies-from-browser", "--limit-rate", "--retries", "--batch-file", "--sync"]) {
    assert.ok(advertised.has(flag), flag);
  }
  assert.equal(buildCapabilities().schema, "lyt.capabilities.v1");
});

test("batch files skip blanks and comments", () => {
  const files = { "a.txt": "# my list\nhttps://youtu.be/aaaaaaaaaaa\n\n  https://soundcloud.com/a/b  \r\n", "-": "https://vimeo.com/1\n" };
  const read = (path) => {
    const key = path === 0 ? "-" : path;
    if (!(key in files)) throw new Error("ENOENT");
    return files[key];
  };
  assert.deepEqual(readBatchFiles(["a.txt", "-"], { read }), [
    "https://youtu.be/aaaaaaaaaaa",
    "https://soundcloud.com/a/b",
    "https://vimeo.com/1",
  ]);
  assert.throws(() => readBatchFiles(["missing.txt"], { read }), /Could not read batch file missing.txt/);
});

test("the end-of-run summary counts each outcome", () => {
  const plain = (text) => text.replace(/\x1B\[[0-9;]*m/g, "");
  assert.equal(plain(summaryLine([{ status: "downloaded" }, { status: "skipped" }, { status: "downloaded" }])), "Done: 2 saved · 1 skipped");
  assert.equal(plain(summaryLine([{ status: "failed" }, { status: "downloaded" }])), "Done: 1 saved · 1 failed");
});

test("new config keys validate values and keep secrets out of output", () => {
  assert.throws(() => validateConfigValue("max-height", "huge"), /./);
  assert.throws(() => validateConfigValue("limit-rate", "fast"), /Invalid --limit-rate/);
  assert.throws(() => validateConfigValue("retries", "-1"), /Invalid --retries/);
  assert.throws(() => validateConfigValue("video", "maybe"), /true or false/);
  for (const [key, value] of [["video", "true"], ["max-height", "1080p"], ["max-filesize", "2G"], ["subs", "yes"], ["sub-langs", "en,de"], ["sponsorblock", "on"], ["retries", "5"], ["spotify-client-id", "abc"]]) {
    assert.doesNotThrow(() => validateConfigValue(key, value), key);
  }
  assert.deepEqual(configToOptions({ video: "true", subs: "yes", "spotify-client-secret": "s" }), { video: true, subs: true });
  assert.equal(displayConfigValue("spotify-client-secret", "s3cret"), "******** (set)");
  assert.equal(displayConfigValue("jobs", "4"), "4");
});

test("yt3/yt4 pick the mode even when config sets one", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-mode-"));
  try {
    const env = { ...process.env, LOCALAPPDATA: join(root, "data"), XDG_DATA_HOME: join(root, "data"), HOME: root, LYT_NO_UPDATE_CHECK: "1" };
    const run = (bin, extra = []) => {
      const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../bin/${bin}.js`, import.meta.url)), ...extra, "--dry-run", "--json", "https://youtu.be/dQw4w9WgXcQ"], { encoding: "utf8", env });
      return JSON.parse(result.stdout).results[0].args;
    };
    spawnSync(process.execPath, [LYT, "config", "set", "video", "true"], { encoding: "utf8", env });
    assert.ok(run("lyt").includes("--merge-output-format"));
    assert.ok(!run("yt3").includes("--merge-output-format"));
    assert.ok(!run("lyt", ["--audio"]).includes("--merge-output-format"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("playlist and channel links are refused without --playlist", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-guard-"));
  try {
    const env = { ...process.env, LOCALAPPDATA: root, XDG_DATA_HOME: root, HOME: root, LYT_NO_UPDATE_CHECK: "1" };
    const run = (...args) => spawnSync(process.execPath, [LYT, ...args], { encoding: "utf8", env });

    const refused = run("--dry-run", "--json", "https://www.youtube.com/playlist?list=PL123", "https://soundcloud.com/forss/sets/soulhack");
    assert.equal(refused.status, 2);
    const error = JSON.parse(refused.stdout).error;
    assert.match(error.message, /a YouTube playlist/);
    assert.match(error.message, /a SoundCloud set/);
    assert.match(error.message, /--playlist/);

    const allowed = run("--dry-run", "--json", "--playlist", "https://www.youtube.com/playlist?list=PL123");
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(JSON.parse(allowed.stdout).results[0].status, "planned");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("batch files feed the download list from the command line", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-batch-"));
  try {
    const list = join(root, "links.txt");
    writeFileSync(list, "# links\nhttps://youtu.be/aaaaaaaaaaa\nhttps://youtu.be/aaaaaaaaaaa?si=dupe\nhttps://soundcloud.com/a/b\n");
    const env = { ...process.env, LOCALAPPDATA: root, XDG_DATA_HOME: root, HOME: root, LYT_NO_UPDATE_CHECK: "1" };
    const result = spawnSync(process.execPath, [LYT, "--dry-run", "--json", "-a", list], { encoding: "utf8", env });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).results.map((entry) => entry.url), [
      "https://youtu.be/aaaaaaaaaaa",
      "https://soundcloud.com/a/b",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("doctor --network reports each site without failing the core check", async () => {
  const checks = await checkNetwork({
    fetchImpl: async (url) => {
      if (url.includes("spotify")) throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
      return { status: 200 };
    },
  });
  assert.equal(checks.length, 4);
  assert.ok(checks.every((check) => check.required === false));
  const spotify = checks.find((check) => check.name === "network-spotify");
  assert.equal(spotify.ok, false);
  assert.match(spotify.hint, /ENOTFOUND/);
  assert.ok(checks.filter((check) => check.name !== "network-spotify").every((check) => check.ok));
});

test("cover embedding replaces the picture without re-encoding audio", () => {
  const mp3 = coverArgs("song.mp3", "cover.jpg", "out.mp3");
  assert.deepEqual(mp3.slice(mp3.indexOf("-map"), mp3.indexOf("-map") + 6), ["-map", "0:a", "-map", "1:0", "-c", "copy"]);
  assert.ok(mp3.includes("attached_pic"));
  assert.equal(mp3.at(-1), "out.mp3");
  assert.ok(coverArgs("song.m4a", "cover.jpg", "out.m4a").includes("-disposition:v:0"));
});

test("lyt info describes Spotify collections with their songs", () => {
  const info = spotifyInfo("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", {
    name: "Album",
    type: "album",
    coverUrl: "https://covers.example/a.jpg",
    truncated: false,
    tracks: [{ title: "One", artist: "A", durationMs: 61000 }, { title: "Two", artist: "A", durationMs: 59000 }],
  });
  assert.equal(info.extractor, "Spotify");
  assert.equal(info.id, "4aawyAB9vmqN3uQ7FjRGTy");
  assert.equal(info.durationSeconds, 120);
  assert.equal(info.thumbnail, "https://covers.example/a.jpg");
  assert.deepEqual(info.spotify.tracks[1], { position: 2, artist: "A", title: "Two", durationSeconds: 59 });
});
