import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  dedupePositionalUrls,
  parseHistoryArgs,
  prepareDownloadArgv,
} from "../src/entry.js";
import { buildArtifactFingerprint } from "../src/history.js";
import { normalizeOptions, parseArgs } from "../src/ytDlp.js";

function fingerprintFor(argv) {
  return buildArtifactFingerprint(normalizeOptions(parseArgs(argv).options));
}

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
  const audio = fingerprintFor(["--audio", "URL"]);
  const mp3 = fingerprintFor(["--mp3", "-q", "192K", "URL"]);
  const video720 = fingerprintFor(["--video", "-q", "720p", "URL"]);
  const video1080 = fingerprintFor(["--video", "-q", "1080p", "URL"]);
  const clip = fingerprintFor(["--mp3", "--clip", "0:00-0:30", "URL"]);

  assert.equal(audio.mode, "audio");
  assert.equal(mp3.mode, "mp3");
  assert.notEqual(audio.fingerprint, mp3.fingerprint);
  assert.notEqual(video720.fingerprint, video1080.fingerprint);
  assert.notEqual(mp3.fingerprint, clip.fingerprint);
});

test("artifact fingerprints do not depend on URLs being present in raw argv", () => {
  const direct = fingerprintFor(["--video", "URL"]);
  const paste = fingerprintFor(["--video", "--paste"]);
  const watch = fingerprintFor(["--video", "--watch"]);
  const interactive = fingerprintFor(["--video", "--interactive"]);

  assert.equal(paste.fingerprint, direct.fingerprint);
  assert.equal(watch.fingerprint, direct.fingerprint);
  assert.equal(interactive.fingerprint, direct.fingerprint);
});

test("the CLI visibly reports corrupt config recovery exactly once", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-entry-config-"));
  const env = { ...process.env };
  let dataRoot;

  if (process.platform === "win32") {
    env.LOCALAPPDATA = root;
    dataRoot = join(root, "lyt");
  } else if (process.platform === "darwin") {
    env.HOME = root;
    dataRoot = join(root, "Library", "Application Support", "lyt");
  } else {
    env.XDG_DATA_HOME = root;
    dataRoot = join(root, "lyt");
  }

  try {
    mkdirSync(dataRoot, { recursive: true });
    writeFileSync(join(dataRoot, "config.json"), "{ not json");
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../bin/lyt.js", import.meta.url)), "--audio", "--dry-run", "URL"],
      { encoding: "utf8", env },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stderr.match(/ignored a corrupt config/g) ?? []).length, 1);
    assert.equal(existsSync(join(dataRoot, "config.json")), false);
    assert.equal(
      readdirSync(dataRoot).some((name) => name.startsWith("config.json.corrupt-")),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
