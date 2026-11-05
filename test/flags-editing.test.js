import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildArtifactFingerprint } from "../src/history.js";
import { needsFfmpeg } from "../src/download.js";
import { validateConfigValue } from "../src/config.js";
import { buildYtDlpArgs, EDITOR_FORMAT_SORT, normalizeOptions, parseArgs } from "../src/ytDlp.js";

const MEDIA_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const argsFor = (argv) => {
  const { options } = parseArgs(argv);
  return buildYtDlpArgs(MEDIA_URL, normalizeOptions(options), { runtimeArgs: [] });
};
const valueAfter = (args, flag) => args[args.indexOf(flag) + 1];
const usage = (fn) => assert.throws(fn, (error) => error.exitCode === 2);

test("--editor picks editor-friendly H.264/AAC video in an MP4", () => {
  const args = argsFor(["--editor"]);
  assert.equal(valueAfter(args, "-S"), EDITOR_FORMAT_SORT);
  assert.equal(valueAfter(args, "--merge-output-format"), "mp4");
  assert.ok(valueAfter(args, "-f").startsWith("bestvideo"));
  // --h264 is the same switch and implies video mode.
  assert.equal(normalizeOptions(parseArgs(["--h264"]).options).video, true);
  // Plain --video keeps yt-dlp's default quality ordering.
  assert.ok(!argsFor(["--video"]).includes("-S"));
});

test("--audio-format converts to the chosen format and skips bitrate for lossless", () => {
  const wav = argsFor(["--audio-format", "wav"]);
  assert.equal(valueAfter(wav, "--audio-format"), "wav");
  assert.ok(wav.includes("-x"));
  assert.ok(!wav.includes("--audio-quality"));

  const m4a = argsFor(["--audio-format", "M4A", "-q", "256K"]);
  assert.equal(valueAfter(m4a, "--audio-format"), "m4a");
  assert.equal(valueAfter(m4a, "--audio-quality"), "256K");
  assert.equal(valueAfter(m4a, "-f"), "bestaudio[ext=m4a]/bestaudio");

  // mp3 through either spelling yields the same arguments.
  assert.deepEqual(argsFor(["--audio-format", "mp3"]), argsFor(["--mp3"]));
  // native is the default and does not convert.
  assert.ok(!argsFor(["--audio-format", "native"]).includes("-x"));
  usage(() => normalizeOptions({ audioFormat: "aiff" }));
});

test("the last of --mp3, --native, and --audio-format wins", () => {
  assert.equal(normalizeOptions(parseArgs(["--audio-format", "flac", "--mp3"]).options).audioFormat, "mp3");
  assert.equal(normalizeOptions(parseArgs(["--mp3", "--native"]).options).audioFormat, null);
  assert.equal(normalizeOptions(parseArgs(["--mp3", "--audio-format", "wav"]).options).audioFormat, "wav");
});

test("normalization keeps an explicit lossless format and otherwise implies MP3", () => {
  assert.equal(normalizeOptions({ normalize: true }).audioFormat, "mp3");
  assert.equal(normalizeOptions({ normalize: true, audioFormat: "wav" }).audioFormat, "wav");
});

test("--container sets the merge format for video and rejects unknown containers", () => {
  assert.equal(valueAfter(argsFor(["--video", "--container", "mkv"]), "--merge-output-format"), "mkv");
  usage(() => normalizeOptions({ video: true, container: "avi" }));
  // Audio mode ignores a container chosen in config.
  assert.equal(normalizeOptions({ container: "mkv" }).container, null);
});

test("--name sets a literal file name and keeps yt-dlp's extension", () => {
  const args = argsFor(["--video", "-n", "intro 100% take.mp4", "-o", "out"]);
  assert.match(valueAfter(args, "-o"), /intro 100%% take\.%\(ext\)s$/);
  for (const bad of ["", "../escape", "/abs/path", "C:\\x", "a//b"]) {
    usage(() => normalizeOptions({ name: bad }));
  }
});

test("--name refuses jobs that would write several files to one name", () => {
  const bin = fileURLToPath(new URL("../bin/lyt.js", import.meta.url));
  const run = spawnSync(process.execPath, [bin, "--dry-run", "--json", "--name", "x", MEDIA_URL, "https://youtu.be/aaaaaaaaaaa"], {
    encoding: "utf8",
    env: { ...process.env, LYT_NO_UPDATE_CHECK: "1", LYT_NO_DOWNLOAD: "1" },
  });
  assert.equal(run.status, 2);
  assert.match(run.stdout + run.stderr, /--name sets one file name/);
});

test("--chapter matches chapter titles literally and case-insensitively", () => {
  const args = argsFor(["--chapter", "Q&A (live)"]);
  assert.equal(valueAfter(args, "--download-sections"), "(?i)Q&A \\(live\\)");
  assert.ok(args.includes("--force-keyframes-at-cuts"));
  usage(() => normalizeOptions({ chapters: ["  "] }));
});

test("--thumbnail and --info-json write sidecar files", () => {
  const args = argsFor(["--thumbnail", "--info-json"]);
  assert.ok(args.includes("--write-thumbnail"));
  assert.equal(valueAfter(args, "--convert-thumbnails"), "jpg");
  assert.ok(args.includes("--write-info-json"));
  // Audio cover art already converts to JPEG; do not ask twice.
  const both = argsFor(["--thumbnail", "--embed-thumbnail"]);
  assert.equal(both.filter((arg) => arg === "--convert-thumbnails").length, 1);
});

test("playlist filters map to yt-dlp's item, date, and duration filters", () => {
  const args = argsFor([
    "--playlist", "--items", "1-5,8,10-", "--max-items", "20",
    "--after", "2026-01-31", "--before", "today",
    "--min-duration", "1:30", "--max-duration", "600",
  ]);
  assert.equal(valueAfter(args, "--playlist-items"), "1:5,8,10:");
  assert.equal(valueAfter(args, "--playlist-end"), "20");
  assert.equal(valueAfter(args, "--dateafter"), "20260131");
  assert.equal(valueAfter(args, "--datebefore"), "today");
  assert.equal(valueAfter(args, "--match-filter"), "duration >=? 90 & duration <=? 600");
  usage(() => normalizeOptions({ items: "first five" }));
  usage(() => normalizeOptions({ dateAfter: "last tuesday" }));
  usage(() => normalizeOptions({ minDuration: "600", maxDuration: "60" }));
  usage(() => normalizeOptions({ maxItems: "0" }));
});

test("duration filters share one --match-filter with a search filter", () => {
  const options = { ...normalizeOptions({ maxDuration: "900" }), matchFilter: "!is_live" };
  const args = buildYtDlpArgs(MEDIA_URL, options, { runtimeArgs: [] });
  assert.equal(args.filter((arg) => arg === "--match-filter").length, 1);
  assert.equal(valueAfter(args, "--match-filter"), "!is_live & duration <=? 900");
  assert.equal(valueAfter(args, "--max-downloads"), "1");
  // A duration filter alone never stops a playlist early.
  assert.ok(!argsFor(["--max-duration", "900"]).includes("--max-downloads"));
});

test("--wait and --polite add waiting and request spacing", () => {
  const args = argsFor(["--wait", "--polite"]);
  assert.equal(valueAfter(args, "--wait-for-video"), "60");
  assert.equal(valueAfter(args, "--sleep-requests"), "1");
  assert.ok(args.includes("--max-sleep-interval"));
});

test("new output variants get their own history fingerprint; defaults keep the old one", () => {
  const base = buildArtifactFingerprint(normalizeOptions({ video: true })).fingerprint;
  assert.equal(buildArtifactFingerprint(normalizeOptions({ video: true, container: "mp4" })).fingerprint, base);
  assert.notEqual(buildArtifactFingerprint(normalizeOptions({ video: true, editor: true })).fingerprint, base);
  assert.notEqual(buildArtifactFingerprint(normalizeOptions({ video: true, container: "mkv" })).fingerprint, base);
  const mp3 = buildArtifactFingerprint(normalizeOptions({ mp3: true })).fingerprint;
  assert.equal(buildArtifactFingerprint(normalizeOptions({ audioFormat: "mp3" })).fingerprint, mp3);
  assert.notEqual(buildArtifactFingerprint(normalizeOptions({ audioFormat: "wav" })).fingerprint, mp3);
});

test("conversions and sidecars require ffmpeg", () => {
  assert.equal(needsFfmpeg(normalizeOptions({ audioFormat: "wav" })), true);
  assert.equal(needsFfmpeg(normalizeOptions({ chapters: ["intro"] })), true);
  assert.equal(needsFfmpeg(normalizeOptions({})), false);
});

test("config accepts the new defaults and rejects bad values at set time", () => {
  validateConfigValue("audio-format", "flac");
  validateConfigValue("container", "mkv");
  validateConfigValue("editor", "true");
  validateConfigValue("polite", "on");
  usage(() => validateConfigValue("audio-format", "aiff"));
  usage(() => validateConfigValue("container", "avi"));
});
