import test from "node:test";
import assert from "node:assert/strict";
import { clipboardCommands, readClipboard } from "../src/clipboard.js";
import {
  mergeClipboardUrls,
  shouldReadClipboardForUrls,
} from "../src/cli.js";

test("each platform has at least one clipboard reader", () => {
  assert.equal(clipboardCommands("win32")[0][0], "powershell.exe");
  assert.equal(clipboardCommands("darwin")[0][0], "pbpaste");

  const linux = clipboardCommands("linux").map(([command]) => command);
  assert.deepEqual(linux, ["wl-paste", "xclip", "xsel"]);
});

test("readClipboard returns stdout from the first working tool", () => {
  const calls = [];
  const spawn = (command) => {
    calls.push(command);

    if (command === "wl-paste") {
      return { error: new Error("ENOENT"), status: null };
    }

    return { status: 0, stdout: "https://youtu.be/dQw4w9WgXcQ" };
  };

  const text = readClipboard({ platform: "linux", spawn, resolve: (command) => command });

  assert.equal(text, "https://youtu.be/dQw4w9WgXcQ");
  assert.deepEqual(calls, ["wl-paste", "xclip"]);
});

test("readClipboard returns empty string when no tool works", () => {
  const spawn = () => ({ error: new Error("ENOENT"), status: null });

  assert.equal(readClipboard({ platform: "linux", spawn, resolve: (command) => command }), "");
});

test("readClipboard survives a spawn that throws", () => {
  const spawn = () => {
    throw new Error("boom");
  };

  assert.equal(readClipboard({ platform: "darwin", spawn, resolve: (command) => command }), "");
});

test("auto-reads clipboard only on interactive TTY with no URL", () => {
  assert.equal(
    shouldReadClipboardForUrls({ urls: [], isTTY: true }),
    true,
  );
  assert.equal(
    shouldReadClipboardForUrls({ urls: [], isTTY: false }),
    false,
  );
  assert.equal(
    shouldReadClipboardForUrls({ urls: ["https://youtu.be/dQw4w9WgXcQ"], isTTY: true }),
    false,
  );
  assert.equal(
    shouldReadClipboardForUrls({ urls: [], isTTY: true, json: true }),
    false,
  );
  assert.equal(
    shouldReadClipboardForUrls({ urls: [], isTTY: false, paste: true }),
    true,
  );
  assert.equal(
    shouldReadClipboardForUrls({ urls: [], isTTY: true, watch: true }),
    false,
  );
});

test("mergeClipboardUrls auto-paste is silent when clipboard is empty", () => {
  const result = mergeClipboardUrls({
    urls: [],
    clipboardText: "no links here",
    paste: false,
  });
  assert.deepEqual(result.urls, []);
  assert.deepEqual(result.fromClipboard, []);
});

test("mergeClipboardUrls explicit paste errors when clipboard has no URLs", () => {
  assert.throws(
    () => mergeClipboardUrls({ urls: [], clipboardText: "", paste: true }),
    /No YouTube URLs found on the clipboard/,
  );
});

test("mergeClipboardUrls picks up and dedupes clipboard links", () => {
  const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const result = mergeClipboardUrls({
    urls: [url],
    clipboardText: `${url} and https://youtu.be/dQw4w9WgXcQ`,
    paste: true,
  });
  assert.equal(result.urls.length, 1);
  assert.equal(result.fromClipboard.length, 1);
});
