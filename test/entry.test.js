import test from "node:test";
import assert from "node:assert/strict";
import {
  buildArtifactFingerprint,
  dedupePositionalUrls,
  parseHistoryArgs,
  prepareDownloadArgv,
} from "../src/entry.js";

test("JSON mode removes human command printing", () => {
  assert.deepEqual(
    prepareDownloadArgv(["--video", "--json", "--print-command", "URL"]),
    ["--video", "--json", "URL"],
  );
  assert.deepEqual(
    prepareDownloadArgv(["--video", "--print-command", "URL"]),
    ["--video", "--print-command", "URL"],
  );
});

test("force overwrite inserts the history override before the URL boundary", () => {
  assert.deepEqual(
    prepareDownloadArgv(["--force-overwrite", "--", "URL"]),
    ["--force-overwrite", "--redownload", "--", "URL"],
  );
});

test("deduplicates direct URLs without consuming option values", () => {
  assert.deepEqual(
    dedupePositionalUrls([
      "--video",
      "-q",
      "1080p",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/aaaaaaaaaaa",
    ]),
    [
      "--video",
      "-q",
      "1080p",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtu.be/aaaaaaaaaaa",
    ],
  );
});

test("history parsing keeps --limit values out of the query", () => {
  assert.deepEqual(parseHistoryArgs(["podcast", "--limit", "50"]), {
    clear: false,
    json: false,
    limit: 50,
    query: "podcast",
  });
  assert.deepEqual(parseHistoryArgs(["--limit", "50"]), {
    clear: false,
    json: false,
    limit: 50,
    query: "",
  });
});

test("history parsing rejects invalid combinations", () => {
  assert.throws(() => parseHistoryArgs(["--limit", "0"]), /positive integer/);
  assert.throws(() => parseHistoryArgs(["--clear", "podcast"]), /cannot be combined/);
  assert.throws(() => parseHistoryArgs(["--unknown"]), /Unknown history option/);
});

test("artifact fingerprints separate output variants", () => {
  const audio = buildArtifactFingerprint(["--audio", "URL"]);
  const mp3 = buildArtifactFingerprint(["--mp3", "-q", "192K", "URL"]);
  const video720 = buildArtifactFingerprint(["--video", "-q", "720p", "URL"]);
  const video1080 = buildArtifactFingerprint(["--video", "-q", "1080p", "URL"]);
  const clip = buildArtifactFingerprint(["--mp3", "--clip", "0:00-0:30", "URL"]);

  assert.equal(audio.mode, "audio");
  assert.equal(mp3.mode, "mp3");
  assert.notEqual(audio.fingerprint, mp3.fingerprint);
  assert.notEqual(video720.fingerprint, video1080.fingerprint);
  assert.notEqual(mp3.fingerprint, clip.fingerprint);
});
