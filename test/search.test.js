import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { parseSearch, searchMedia } from "../src/search.js";
import { parseSearchArgs, runSearchCommand } from "../src/commands/search.js";

const sample = { entries: [null,
  { id: "39XR4EXFz5Y", title: "Song", channel: "Artist", duration: 168, url: "https://signed.example/private", thumbnails: [{ url: "https://example.com/image.jpg" }] },
  { id: "39XR4EXFz5Y", title: "Duplicate" },
  { id: "abc123def45", title: "Live", live_status: "is_live" },
  { id: "bad-id", title: "Bad" },
  { id: "abc123def46", live_status: "is_upcoming" },
] };

test("search shapes candidates, deduplicates IDs, and returns canonical URLs only", () => {
  const results = parseSearch(sample);
  assert.equal(results.length, 3);
  assert.equal(results[0].url, "https://www.youtube.com/watch?v=39XR4EXFz5Y");
  assert.equal(results[0].durationSeconds, 168);
  assert.equal(results[1].durationSeconds, null);
  assert.equal(results[1].isLive, true);
  assert.equal(results[2].isUpcoming, true);
  assert.deepEqual(results.map((item) => item.index), [1, 2, 3]);
  assert.equal(parseSearch(sample, 1).length, 1);
  assert.deepEqual(parseSearch({ entries: [] }), []);
  assert.throws(() => parseSearch({}), (error) => error.kind === "tool_output_invalid");
});

test("search bounds queries/results and handles literal option-looking queries", () => {
  assert.deepEqual(parseSearchArgs(["artist", "song", "--limit", "10", "--json"]),
    { query: "artist song", limit: 10, json: true, noDownload: false, help: false });
  assert.equal(parseSearchArgs(["--", "--exec evil"]).query, "--exec evil");
  for (const argv of [[], [" "], ["x", "--limit"], ["x", "--limit", "0"], ["x", "--limit", "26"], ["x", "--limit", "1.5"], ["x", "--video"], ["x".repeat(501)]]) {
    assert.throws(() => parseSearchArgs(argv), (error) => error.exitCode === 2);
  }
});

test("search runs simulation with isolated options and no downloader configuration", async () => {
  let args;
  const spawnFn = (_command, input) => {
    args = input;
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    setImmediate(() => { child.stdout.write(JSON.stringify(sample)); child.emit("close", 0); });
    return child;
  };
  const results = await searchMedia("--exec $(evil)", { limit: 3, spawnFn, runtimeArgs: [] });
  assert.equal(results.length, 3);
  for (const flag of ["--ignore-config", "--flat-playlist", "--skip-download", "--dump-single-json"]) assert.ok(args.includes(flag));
  assert.deepEqual(args.slice(-2), ["--", "ytsearch3:--exec $(evil)"]);
});

test("search emits one envelope for setup failures without leaking a second result", async () => {
  const logs = [];
  const error = Object.assign(new Error("yt-dlp was not found"), { exitCode: 127 });
  await assert.rejects(runSearchCommand(["song", "--json", "--no-download"], {
    ensureTool: async (options) => { assert.equal(options.noDownload, true); throw error; },
    log: (value) => logs.push(value),
  }));
  assert.equal(logs.length, 1);
  const payload = JSON.parse(logs[0]);
  assert.equal(payload.schema, "lyt.search.v1");
  assert.equal(payload.error.kind, "tool_missing");
  assert.equal(error.jsonPrinted, true);
});

test("search returns an empty successful envelope instead of auto-downloading", async () => {
  let payload;
  await runSearchCommand(["song", "--json"], {
    ensureTool: async () => "test-tool", search: async () => [], log: (value) => { payload = JSON.parse(value); },
  });
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.results, []);
});
