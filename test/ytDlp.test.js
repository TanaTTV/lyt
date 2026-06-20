import test from "node:test";
import assert from "node:assert/strict";
import {
  buildYtDlpArgs,
  formatCommand,
  normalizeOptions,
  parseArgs,
  parseClip,
} from "../src/ytDlp.js";

test("defaults to fast native audio without conversion", () => {
  const options = normalizeOptions();
  const args = buildYtDlpArgs("https://youtube.test/video", options);

  assert.equal(options.mp3, false);
  assert.deepEqual(args.slice(0, 2), ["--newline", "--no-warnings"]);
  assert.ok(args.includes("bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio"));
  assert.ok(args.includes("--concurrent-fragments"));
  assert.ok(args.includes("--no-playlist"));
  assert.equal(args.includes("-x"), false);
});

test("mp3 mode adds extraction and audio quality flags", () => {
  const options = normalizeOptions({ mp3: true, quality: "128k" });
  const args = buildYtDlpArgs("https://youtube.test/video", options);

  assert.ok(args.includes("-x"));
  assert.ok(args.includes("--audio-format"));
  assert.ok(args.includes("mp3"));
  assert.ok(args.includes("--audio-quality"));
  assert.ok(args.includes("128K"));
});

test("video mode selects best video+audio and muxes to mp4", () => {
  const options = normalizeOptions({ video: true });
  const args = buildYtDlpArgs("https://youtube.test/video", options);

  assert.equal(args[args.indexOf("-f") + 1], "bestvideo+bestaudio/best");
  assert.equal(args[args.indexOf("--merge-output-format") + 1], "mp4");
  assert.equal(args.includes("-x"), false);
});

test("video max-height caps the selected resolution", () => {
  const options = normalizeOptions({ video: true, maxHeight: "1080" });
  const args = buildYtDlpArgs("https://youtube.test/video", options);

  assert.equal(
    args[args.indexOf("-f") + 1],
    "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
  );
});

test("video mode forces audio extraction off even if mp3 is set", () => {
  const options = normalizeOptions({ video: true, mp3: true });

  assert.equal(options.mp3, false);
  assert.equal(buildYtDlpArgs("u", options).includes("--audio-format"), false);
});

test("--audio after --video selects audio (explicit flags win)", () => {
  const parsed = parseArgs(["--video", "--audio", "u"]);

  assert.equal(parsed.options.video, false);
});

test("max-height is ignored without video mode", () => {
  assert.equal(normalizeOptions({ maxHeight: "1080" }).maxHeight, null);
});

test("video quality presets map to a max height", () => {
  assert.equal(normalizeOptions({ video: true, quality: "8k" }).maxHeight, 4320);
  assert.equal(normalizeOptions({ video: true, quality: "4k" }).maxHeight, 2160);
  assert.equal(normalizeOptions({ video: true, quality: "1080p" }).maxHeight, 1080);
  assert.equal(normalizeOptions({ video: true, quality: "720" }).maxHeight, 720);
});

test("video 'best' quality means no resolution cap", () => {
  const options = normalizeOptions({ video: true, quality: "best" });
  const args = buildYtDlpArgs("u", options);

  assert.equal(options.maxHeight, null);
  assert.equal(args[args.indexOf("-f") + 1], "bestvideo+bestaudio/best");
});

test("--max-height wins over -q in video mode", () => {
  const options = normalizeOptions({ video: true, quality: "4k", maxHeight: "720p" });
  assert.equal(options.maxHeight, 720);
});

test("invalid video quality is rejected with exit code 2", () => {
  try {
    normalizeOptions({ video: true, quality: "ultra" });
    assert.fail("expected throw");
  } catch (error) {
    assert.match(error.message, /quality must/);
    assert.equal(error.exitCode, 2);
  }
});

test("-q stays an MP3 bitrate in audio mode", () => {
  const options = normalizeOptions({ mp3: true, quality: "320k" });
  assert.equal(options.quality, "320K");
  assert.equal(options.maxHeight, null);
});

test("-L sets the list-formats flag", () => {
  assert.equal(parseArgs(["-L", "u"]).options.listFormats, true);
  assert.equal(parseArgs(["--list-formats", "u"]).options.listFormats, true);
});

test("yt4-style video default still parses multiple urls", () => {
  const parsed = parseArgs(["one", "two", "three"]);
  const merged = normalizeOptions({ ...{ video: true }, ...parsed.options });

  assert.deepEqual(parsed.urls, ["one", "two", "three"]);
  assert.equal(merged.video, true);
});

test("parses multiple urls and speed options", () => {
  const parsed = parseArgs([
    "--mp3",
    "--quality",
    "192K",
    "--fragments",
    "16",
    "--jobs",
    "3",
    "one",
    "two",
  ]);
  const options = normalizeOptions(parsed.options);

  assert.deepEqual(parsed.urls, ["one", "two"]);
  assert.equal(options.mp3, true);
  assert.equal(options.fragments, 16);
  assert.equal(options.jobs, 3);
});

test("-- ends option parsing and allows dash-leading urls", () => {
  const parsed = parseArgs(["--mp3", "--", "-weird-url", "--another"]);

  assert.deepEqual(parsed.urls, ["-weird-url", "--another"]);
  assert.equal(parsed.options.mp3, true);
});

test("url is isolated behind -- so it cannot be read as a flag", () => {
  const args = buildYtDlpArgs("--exec=evil", normalizeOptions({}));

  assert.equal(args.at(-2), "--");
  assert.equal(args.at(-1), "--exec=evil");
});

test("force-overwrite suppresses continue/no-overwrites and adds force-overwrites", () => {
  const args = buildYtDlpArgs("u", normalizeOptions({ forceOverwrite: true }));

  assert.ok(args.includes("--force-overwrites"));
  assert.equal(args.includes("--continue"), false);
  assert.equal(args.includes("--no-overwrites"), false);
});

test("default adds continue and no-overwrites", () => {
  const args = buildYtDlpArgs("u", normalizeOptions({}));

  assert.ok(args.includes("--continue"));
  assert.ok(args.includes("--no-overwrites"));
});

test("--playlist omits --no-playlist", () => {
  const args = buildYtDlpArgs("u", normalizeOptions({ playlist: true }));

  assert.equal(args.includes("--no-playlist"), false);
});

test("external downloader args are namespaced for yt-dlp", () => {
  const args = buildYtDlpArgs(
    "u",
    normalizeOptions({ downloader: "aria2c", downloaderArgs: "-x16 -s16" }),
  );

  const flagIndex = args.indexOf("--downloader");
  assert.equal(args[flagIndex + 1], "aria2c");
  const argsIndex = args.indexOf("--downloader-args");
  assert.equal(args[argsIndex + 1], "aria2c:-x16 -s16");
});

test("downloader args already namespaced are passed through unchanged", () => {
  const args = buildYtDlpArgs(
    "u",
    normalizeOptions({ downloader: "aria2c", downloaderArgs: "aria2c:-x8" }),
  );

  assert.equal(args[args.indexOf("--downloader-args") + 1], "aria2c:-x8");
});

test("--no-part is emitted only when requested", () => {
  assert.equal(buildYtDlpArgs("u", normalizeOptions({})).includes("--no-part"), false);
  assert.ok(buildYtDlpArgs("u", normalizeOptions({ noPart: true })).includes("--no-part"));
});

test("--downloader-args accepts dash-leading values", () => {
  const parsed = parseArgs(["--downloader", "aria2c", "--downloader-args", "-x16 -s16", "u"]);

  assert.equal(parsed.options.downloaderArgs, "-x16 -s16");
});

test("-i sets interactive option", () => {
  assert.equal(parseArgs(["-i"]).options.interactive, true);
  assert.equal(parseArgs(["--interactive"]).options.interactive, true);
});

test("unknown option throws with exit code 2", () => {
  try {
    parseArgs(["--nope", "u"]);
    assert.fail("expected throw");
  } catch (error) {
    assert.match(error.message, /Unknown option/);
    assert.equal(error.exitCode, 2);
  }
});

test("option flag at end of argv with no value throws", () => {
  for (const flag of ["-o", "-q", "-f", "-j", "--template", "--downloader"]) {
    assert.throws(() => parseArgs([flag]), /needs a value/);
  }
});

test("value beginning with dash is rejected for normal options", () => {
  assert.throws(() => parseArgs(["-o", "-x", "u"]), /needs a value/);
});

test("empty url argument is rejected", () => {
  assert.throws(() => parseArgs([""]), /Empty URL/);
  assert.throws(() => parseArgs(["--", ""]), /Empty URL/);
});

test("quality accepts 0 and bare digits, rejects garbage", () => {
  assert.equal(normalizeOptions({ quality: "0" }).quality, "0");
  assert.equal(normalizeOptions({ quality: "192" }).quality, "192");
  assert.equal(normalizeOptions({ quality: "192k" }).quality, "192K");
  assert.throws(() => normalizeOptions({ quality: "192kbps" }), /quality must/);
  assert.throws(() => normalizeOptions({ quality: "abc" }), /quality must/);
});

test("jobs and fragments reject non-integer garbage", () => {
  for (const bad of ["16abc", "2.9", "0x10", " ", "1e3", "0", "-3"]) {
    assert.throws(() => normalizeOptions({ jobs: bad }), /positive integer/);
    assert.throws(() => normalizeOptions({ fragments: bad }), /positive integer/);
  }
});

test("formatCommand quotes args with spaces and escapes quotes", () => {
  assert.equal(formatCommand("c", ["a b"]), 'c "a b"');
  assert.equal(formatCommand("c", ['a"b']), 'c "a\\"b"');
});

// ---------------------------------------------------------------------------
// Clips (--clip / --download-sections)
// ---------------------------------------------------------------------------

test("parseClip converts ranges into yt-dlp section syntax", () => {
  assert.equal(parseClip("1:10-2:45"), "*1:10-2:45");
  assert.equal(parseClip("90-180"), "*90-180");
  assert.equal(parseClip("01:02:03-01:05:00"), "*01:02:03-01:05:00");
  assert.equal(parseClip("1:10-"), "*1:10-inf");
  assert.equal(parseClip("-2:45"), "*0-2:45");
  assert.equal(parseClip(" 0:05-0:10 "), "*0:05-0:10");
});

test("parseClip rejects malformed and inverted ranges", () => {
  for (const bad of ["", "-", "abc", "1:10", "1;10-2;45", "x-y"]) {
    assert.throws(() => parseClip(bad), /clip must look like/, bad);
  }

  assert.throws(() => parseClip("2:45-1:10"), /start must be before/);
  assert.throws(() => parseClip("90-90"), /start must be before/);
});

test("--clip is repeatable and emits download-sections with keyframe cuts", () => {
  const parsed = parseArgs(["--clip", "1:10-2:45", "--clip", "-0:30", "u"]);
  const options = normalizeOptions(parsed.options);
  const args = buildYtDlpArgs("u", options);

  assert.deepEqual(options.clips, ["*1:10-2:45", "*0-0:30"]);
  const first = args.indexOf("--download-sections");
  assert.equal(args[first + 1], "*1:10-2:45");
  assert.equal(args[args.indexOf("--download-sections", first + 1) + 1], "*0-0:30");
  assert.ok(args.includes("--force-keyframes-at-cuts"));
});

test("no clips means no section flags", () => {
  const args = buildYtDlpArgs("u", normalizeOptions({}));

  assert.equal(args.includes("--download-sections"), false);
  assert.equal(args.includes("--force-keyframes-at-cuts"), false);
});

// ---------------------------------------------------------------------------
// Chapters (--split-chapters)
// ---------------------------------------------------------------------------

test("--split-chapters adds chapter splitting with a per-video subfolder", () => {
  const parsed = parseArgs(["--split-chapters", "u"]);
  const args = buildYtDlpArgs("u", normalizeOptions(parsed.options));

  assert.ok(args.includes("--split-chapters"));
  const chapterTemplate = args.find((arg) => arg.startsWith("chapter:"));
  assert.ok(chapterTemplate.includes("%(section_number)02d"));
  assert.ok(chapterTemplate.includes("%(section_title)"));
});

// ---------------------------------------------------------------------------
// Loudness normalization (--normalize)
// ---------------------------------------------------------------------------

test("--normalize implies mp3 and adds a loudnorm postprocessor", () => {
  const options = normalizeOptions({ normalize: true });
  const args = buildYtDlpArgs("u", options);

  assert.equal(options.mp3, true);
  assert.ok(args.includes("-x"));
  const ppaIndex = args.indexOf("--postprocessor-args");
  assert.match(args[ppaIndex + 1], /loudnorm=I=-16/);
});

test("--normalize in video mode is rejected", () => {
  assert.throws(
    () => normalizeOptions({ video: true, normalize: true, normalizeExplicit: true }),
    /audio mode only/,
  );
});

test("video mode clears inherited normalization and supports explicit negation", () => {
  assert.equal(normalizeOptions({ video: true, normalize: true }).normalize, false);

  const parsed = parseArgs(["--video", "--no-normalize", "u"]);
  const options = normalizeOptions({ normalize: true, ...parsed.options });
  assert.equal(options.video, true);
  assert.equal(options.normalize, false);
});

// ---------------------------------------------------------------------------
// Clipboard / watch / history flags
// ---------------------------------------------------------------------------

test("paste, watch, redownload, and no-history flags parse", () => {
  const parsed = parseArgs([
    "--paste",
    "--watch",
    "--redownload",
    "--no-history",
  ]);
  const options = normalizeOptions(parsed.options);

  assert.equal(options.paste, true);
  assert.equal(options.watch, true);
  assert.equal(options.redownload, true);
  assert.equal(options.history, false);
});

test("--queue is an alias for --watch and -p for --paste", () => {
  assert.equal(parseArgs(["--queue"]).options.watch, true);
  assert.equal(parseArgs(["-p"]).options.paste, true);
});

test("history is on by default", () => {
  assert.equal(normalizeOptions({}).history, true);
  assert.equal(normalizeOptions({}).redownload, false);
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

test("--profile captures the profile name", () => {
  assert.equal(parseArgs(["--profile", "music", "u"]).options.profile, "music");
  assert.throws(() => parseArgs(["--profile"]), /needs a value/);
});

test("explicit flags win over profile options when merged after", () => {
  // cli.js merges { ...profile, ...explicit }; emulate that here.
  const explicit = parseArgs(["--quality", "128K", "u"]).options;
  const merged = { ...{ mp3: true, quality: "0" }, ...explicit };
  const options = normalizeOptions(merged);

  assert.equal(options.mp3, true);
  assert.equal(options.quality, "128K");
});
