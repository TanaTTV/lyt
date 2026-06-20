import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearHistory,
  loadHistory,
  recordDownload,
  searchHistory,
  splitByHistory,
} from "../src/history.js";

function tempHistoryFile() {
  const dir = mkdtempSync(join(tmpdir(), "lyt-history-"));
  return { file: join(dir, "history.jsonl"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("records and loads history entries in order", () => {
  const { file, cleanup } = tempHistoryFile();

  try {
    recordDownload({ ts: "2026-01-01T00:00:00Z", id: "aaaaaaaaaaa", url: "u1", mode: "audio" }, file);
    recordDownload({ ts: "2026-01-02T00:00:00Z", id: "bbbbbbbbbbb", url: "u2", mode: "video" }, file);

    const entries = loadHistory(file);

    assert.equal(entries.length, 2);
    assert.equal(entries[0].id, "aaaaaaaaaaa");
    assert.equal(entries[1].mode, "video");
  } finally {
    cleanup();
  }
});

test("recordDownload rejects relative target paths", () => {
  assert.throws(() => recordDownload({}, "history.jsonl"), /must be absolute/);
});

test("loadHistory skips corrupt lines instead of throwing", () => {
  const { file, cleanup } = tempHistoryFile();

  try {
    writeFileSync(file, '{"id":"aaaaaaaaaaa"}\nnot json at all\n{"id":"bbbbbbbbbbb"}\n');

    const entries = loadHistory(file);

    assert.deepEqual(entries.map((entry) => entry.id), ["aaaaaaaaaaa", "bbbbbbbbbbb"]);
  } finally {
    cleanup();
  }
});

test("loadHistory returns empty array for a missing file", () => {
  assert.deepEqual(loadHistory(join(tmpdir(), "lyt-no-such-file.jsonl")), []);
});

test("splitByHistory separates known video ids and keeps unknown urls", () => {
  const entries = [{ id: "dQw4w9WgXcQ" }, { id: "aaaaaaaaaaa" }];
  const urls = [
    "https://youtu.be/dQw4w9WgXcQ",          // known -> skipped
    "https://youtu.be/zzzzzzzzzzz",          // unknown -> fresh
    "https://www.youtube.com/playlist?list=PL1", // no id -> always fresh
  ];

  const { fresh, skipped } = splitByHistory(urls, entries);

  assert.deepEqual(skipped, ["https://youtu.be/dQw4w9WgXcQ"]);
  assert.deepEqual(fresh, [
    "https://youtu.be/zzzzzzzzzzz",
    "https://www.youtube.com/playlist?list=PL1",
  ]);
});

test("searchHistory filters case-insensitively across fields", () => {
  const entries = [
    { id: "a", url: "https://youtu.be/a", mode: "audio" },
    { id: "b", url: "https://youtu.be/b", mode: "video" },
  ];

  assert.equal(searchHistory(entries, "VIDEO").length, 1);
  assert.equal(searchHistory(entries, "youtu.be").length, 2);
  assert.equal(searchHistory(entries, "").length, 2);
  assert.equal(searchHistory(entries, "nope").length, 0);
  assert.equal(searchHistory([{ id: "a", metadata: "secret" }], "metadata").length, 0);
});

test("clearHistory removes the file and tolerates a missing one", () => {
  const { file, cleanup } = tempHistoryFile();

  try {
    recordDownload({ id: "aaaaaaaaaaa" }, file);
    clearHistory(file);
    assert.deepEqual(loadHistory(file), []);
    clearHistory(file); // second call must not throw
  } finally {
    cleanup();
  }
});
