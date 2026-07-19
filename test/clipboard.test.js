import test from "node:test";
import assert from "node:assert/strict";
import { clipboardCommands, readClipboard } from "../src/clipboard.js";

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
