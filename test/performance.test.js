import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseInfoArgs } from "../src/commandArgs.js";
import { runInfoCommand } from "../src/commands/info.js";
import { probeOk } from "../src/bootstrap.js";
import { buildArtifactFingerprint } from "../src/history.js";
import { normalizeOptions } from "../src/ytDlp.js";
import { buildTasks, downloadUrls } from "../src/download.js";
import { runCommand } from "../src/process.js";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

test("info accepts bounded concurrency and a positional URL boundary", () => {
  assert.equal(parseInfoArgs(["URL"]).jobs, 3);
  assert.deepEqual(parseInfoArgs(["--json", "-j", "2", "--", "--url"]), {
    json: true, noDownload: false, jobs: 2, urls: ["--url"],
  });
  for (const value of ["0", "17", "-1", "1.5", "Infinity", undefined]) {
    assert.throws(() => parseInfoArgs(["--jobs", value]), /integer from 1 to 16/);
  }
});

test("info bounds active workers, preserves order, and reports partial failure", async () => {
  const previousExitCode = process.exitCode;
  const releases = new Map();
  const starts = [];
  let active = 0;
  let peak = 0;
  let toolCalls = 0;
  const output = [];
  const pending = runInfoCommand(["a", "b", "c", "--jobs", "2", "--json"], {
    ensureTool: async () => { toolCalls++; return "mock-tool"; },
    inspect: (url, { command }) => {
      assert.equal(command, "mock-tool");
      starts.push(url);
      peak = Math.max(peak, ++active);
      return new Promise((resolve, reject) => releases.set(url, () => {
        active--;
        if (url === "b") reject(new Error("unavailable"));
        else resolve({ title: url });
      }));
    },
    log: (line) => output.push(JSON.parse(line)),
  });
  try {
    await new Promise(setImmediate);
    assert.deepEqual(starts, ["a", "b"]);
    releases.get("b")();
    await new Promise(setImmediate);
    assert.deepEqual(starts, ["a", "b", "c"]);
    releases.get("c")();
    releases.get("a")();
    await pending;
    assert.equal(peak, 2);
    assert.equal(toolCalls, 1);
    assert.equal(output.length, 1);
    assert.equal(output[0].ok, false);
    assert.deepEqual(output[0].results.map((r) => [r.url, r.status]), [
      ["a", "available"], ["b", "failed"], ["c", "available"],
    ]);
    assert.equal(process.exitCode, 1);
  } finally {
    for (const release of releases.values()) release();
    await pending;
    process.exitCode = previousExitCode;
  }
});

test("tool probes retain version output only after successful validation", () => {
  const results = new Map();
  let calls = 0;
  const success = { status: 0, stdout: "2026.01.01\n", stderr: "" };
  assert.equal(probeOk("tool", ["--version"], results, () => { calls++; return success; }), true);
  assert.equal(calls, 1);
  assert.equal(results.get("tool"), success);
  assert.equal(probeOk("broken", [], results, () => ({ status: 1 })), false);
  assert.equal(results.has("broken"), false);
});

test("human inspection streams completed input items before the whole batch finishes", async () => {
  const releases = new Map();
  const output = [];
  const pending = runInfoCommand(["first", "second", "--jobs", "2"], {
    ensureTool: async () => "fixture",
    inspect: (url) => new Promise((resolve) => releases.set(url, () => resolve({
      title: url, heights: [], audioBitrates: [],
    }))),
    log: (line) => output.push(line),
  });
  try {
    await new Promise(setImmediate);
    releases.get("first")();
    await new Promise(setImmediate);
    assert.ok(output.some((line) => line.includes("first")));
    assert.ok(!output.some((line) => line.includes("second")));
  } finally {
    for (const release of releases.values()) release();
    await pending;
  }
  assert.ok(output.some((line) => line.includes("second")));
});

test("matching history skips tool preparation but missing files and other variants do not", () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-fast-history-"));
  const env = { ...process.env, PATH: "", LYT_NO_DOWNLOAD: "1", LYT_NO_UPDATE_CHECK: "1" };
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
  const url = "https://youtu.be/dQw4w9WgXcQ";
  const file = join(root, "saved.webm");
  const fingerprint = buildArtifactFingerprint(normalizeOptions({ outputDir: root }));
  const run = (extra = []) => spawnSync(process.execPath, [
    fileURLToPath(new URL("../bin/lyt.js", import.meta.url)),
    "--audio", "--json", "--no-download", "-o", root, ...extra, url,
  ], { env, encoding: "utf8" });
  try {
    mkdirSync(dataRoot, { recursive: true });
    writeFileSync(file, "fixture");
    writeFileSync(join(dataRoot, "history.jsonl"), JSON.stringify({
      id: "dQw4w9WgXcQ", artifact: fingerprint.fingerprint, mode: "audio", dir: root, files: [file],
    }) + "\n");
    const skipped = run();
    assert.equal(skipped.status, 0, skipped.stderr);
    const result = JSON.parse(skipped.stdout).results[0];
    assert.equal(result.reason, "history");
    assert.deepEqual(result.files, [file]);
    for (const extra of [["--redownload"], ["--no-history"], ["--mp3"]]) {
      const attempted = run(extra);
      assert.equal(attempted.status, 127, attempted.stderr);
      assert.match(JSON.parse(attempted.stdout).error.message, /yt-dlp was not found/);
    }
    rmSync(file);
    assert.equal(run().status, 127);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("size-limit skips require an actual downloader size-limit diagnostic", async () => {
  const root = mkdtempSync(join(tmpdir(), "lyt-size-guard-"));
  const options = normalizeOptions({ outputDir: root, maxFilesize: "1M", history: false, json: true });
  try {
    for (const sizeLimited of [false, true]) {
      const result = await downloadUrls(["https://example.com/media"], options, {
        ytDlpCommand: "fixture", ffmpegPath: null,
      }, { execute: async () => ({ files: [], sizeLimited }) });
      assert.equal(result.failures.length, 1);
      assert.equal(result.results[0].reason, sizeLimited ? "max-filesize" : "no-output");
      assert.equal(result.results[0].status, sizeLimited ? "skipped" : "failed");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("download processing detects size-limit diagnostics from either stream", async () => {
  for (const stream of ["stdout", "stderr"]) {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const pending = runCommand("fixture", [], { quiet: true, spawnFn: () => child });
    child[stream].write("[download] File is larger than max-filesize; skipping\n");
    child.emit("close", 0);
    assert.equal((await pending).sizeLimited, true);
  }
});

test("path capture preserves downloader diagnostics without changing dry-run plans", () => {
  const options = normalizeOptions({ json: true });
  const [task] = buildTasks(["URL"], options, { ffmpegPath: null });
  assert.ok(task.args.includes("--no-quiet"));
  assert.ok(task.args.indexOf("--no-quiet") < task.args.indexOf("--"));
  const [plan] = buildTasks(["URL"], options, { ffmpegPath: null }, { capturePaths: false });
  assert.ok(!plan.args.includes("--no-quiet"));
});
