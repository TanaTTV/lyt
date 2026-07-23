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
  findPlanHistoryMatch,
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

test("download preprocessing keeps caption languages and job ids out of URL dedupe", () => {
  assert.deepEqual(
    dedupePositionalUrls([
      "--subs",
      "en,es",
      "--job-id",
      "desktop:job-1",
      "--events-jsonl",
      "https://youtu.be/aaaaaaaaaaa",
    ]),
    [
      "--subs",
      "en,es",
      "--job-id",
      "desktop:job-1",
      "--events-jsonl",
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

test("plan history matches ignore entries whose recorded artifacts were deleted", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-plan-history-"));
  const file = join(root, "existing.mp4");
  const url = "https://youtu.be/dQw4w9WgXcQ";
  const fingerprint = "lyt.artifact.v1:test";
  const entries = [{
    id: "dQw4w9WgXcQ",
    artifact: fingerprint,
    files: [file],
  }];

  try {
    assert.equal(
      findPlanHistoryMatch(url, "dQw4w9WgXcQ", fingerprint, entries),
      null,
    );
    writeFileSync(file, "media");
    assert.equal(
      findPlanHistoryMatch(url, "dQw4w9WgXcQ", fingerprint, entries),
      entries[0],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("receipt and verify commands round-trip a local artifact without remote claims", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-entry-receipt-"));
  const artifact = join(root, "artifact.txt");
  const receipt = `${artifact}.lyt-receipt.json`;
  const cli = fileURLToPath(new URL("../bin/lyt.js", import.meta.url));

  try {
    writeFileSync(artifact, "local artifact");
    const created = spawnSync(
      process.execPath,
      [cli, "receipt", "--sha256", "--json", artifact],
      { encoding: "utf8" },
    );
    assert.equal(created.status, 0, created.stderr);
    const createResult = JSON.parse(created.stdout);
    assert.equal(createResult.ok, true);
    assert.equal(createResult.receipt.assurance.remoteAuthenticityVerified, false);
    assert.equal(existsSync(receipt), true);

    const verified = spawnSync(
      process.execPath,
      [cli, "verify", "--json", receipt],
      { encoding: "utf8" },
    );
    assert.equal(verified.status, 0, verified.stderr);
    const verifyResult = JSON.parse(verified.stdout);
    assert.equal(verifyResult.ok, true);
    assert.equal(verifyResult.assurance.scope, "local-file-integrity-only");

    const sizeOnlyArtifact = join(root, "size-only.txt");
    writeFileSync(sizeOnlyArtifact, "same-size is not same-content");
    const sizeReceipt = spawnSync(
      process.execPath,
      [cli, "receipt", sizeOnlyArtifact],
      { encoding: "utf8" },
    );
    assert.equal(sizeReceipt.status, 0, sizeReceipt.stderr);
    const sizeVerified = spawnSync(
      process.execPath,
      [cli, "verify", `${sizeOnlyArtifact}.lyt-receipt.json`],
      { encoding: "utf8" },
    );
    assert.equal(sizeVerified.status, 0, sizeVerified.stderr);
    assert.match(sizeVerified.stdout, /file size only/);
    assert.match(sizeVerified.stdout, /\[--\] sha256/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid event jobs emit exactly one schema-valid failed JSONL event", () => {
  const cli = fileURLToPath(new URL("../bin/lyt.js", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "--events-jsonl",
      "--job-id",
      "test-job",
      "--print-command",
      "https://example.test/one",
      "https://example.test/two",
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 2);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.equal(event.schema, "lyt.job-event.v1");
  assert.equal(event.jobId, "test-job");
  assert.equal(event.type, "failed");
  assert.equal(event.sequence, 1);
  assert.equal(event.data.stage, "preflight");
});
