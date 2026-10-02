import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { runWatchMode } from "../src/download.js";
import { normalizeOptions } from "../src/ytDlp.js";

const TOOLS = { ytDlpCommand: "fixture", ffmpegPath: null };

function capture() {
  const lines = [];
  const original = console.error;
  const originalWrite = process.stderr.write.bind(process.stderr);
  console.error = (line) => lines.push(String(line));
  process.stderr.write = (chunk) => {
    lines.push(String(chunk));
    return true;
  };
  return {
    lines,
    restore() {
      console.error = original;
      process.stderr.write = originalWrite;
    },
  };
}

test("watch mode downloads new links once, skips collections, and expands Spotify", async () => {
  const clipboard = [
    "https://soundcloud.com/forss/flickermood https://soundcloud.com/forss/sets/soulhack",
    "https://soundcloud.com/forss/flickermood?si=again https://open.spotify.com/track/70cHKK8bHAfJrOGVnfRG9J",
  ];
  const batches = [];
  const out = capture();
  try {
    await runWatchMode([], normalizeOptions({}), TOOLS, {
      read: () => clipboard.shift() ?? "",
      intervalMs: 1,
      expand: async (urls) => urls.map((url) => (url.includes("spotify") ? { url: "ytsearch1:Me - Song audio", label: "Me - Song" } : url)),
      download: async (items) => {
        batches.push(items.map((item) => (typeof item === "string" ? item : item.url)));
        if (batches.length === 2) process.emit("SIGINT");
        return { failures: [], results: [] };
      },
    });
  } finally {
    out.restore();
  }

  assert.deepEqual(batches, [
    ["https://soundcloud.com/forss/flickermood"],
    ["ytsearch1:Me - Song audio"],
  ]);
  assert.ok(out.lines.some((line) => /Skipping https:\/\/soundcloud.com\/forss\/sets\/soulhack: it is a SoundCloud set/.test(line)));
  assert.equal(process.listenerCount("SIGINT"), 0);
});

test("Ctrl+C during a download reports an interruption instead of errors", async () => {
  const out = capture();
  try {
    await runWatchMode(["https://youtu.be/aaaaaaaaaaa"], normalizeOptions({}), TOOLS, {
      read: () => "",
      intervalMs: 1,
      download: async () => {
        process.emit("SIGINT");
        return { failures: [{ url: "https://youtu.be/aaaaaaaaaaa", error: new Error("yt-dlp was stopped (SIGINT)") }], results: [] };
      },
    });
  } finally {
    out.restore();
  }

  assert.ok(out.lines.some((line) => /Interrupted\. Partial downloads are kept/.test(line)));
  assert.ok(!out.lines.some((line) => /was stopped \(SIGINT\)/.test(line)));
});
