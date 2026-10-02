import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import {
  ANSI,
  colorEnabled,
  colorizeHelp,
  ok,
  stripAnsi,
  supportsUnicode,
} from "../src/ui.js";

const tty = { isTTY: true };
const pipe = { isTTY: false };

test("colorEnabled stays off for pipes, NO_COLOR, FORCE_COLOR=0, and dumb terminals", () => {
  assert.equal(colorEnabled(pipe, {}), false);
  assert.equal(colorEnabled(tty, { NO_COLOR: "1" }), false);
  assert.equal(colorEnabled(tty, { FORCE_COLOR: "0" }), false);
  assert.equal(colorEnabled(tty, { TERM: "dumb" }), false);
});

test("colorEnabled turns on for a TTY or FORCE_COLOR, and NO_COLOR wins", () => {
  assert.equal(colorEnabled(tty, {}), true);
  assert.equal(colorEnabled(pipe, { FORCE_COLOR: "1" }), true);
  assert.equal(colorEnabled(tty, { FORCE_COLOR: "1", NO_COLOR: "1" }), false);
});

test("paint helpers are no-ops without color and wrap with ANSI when forced", () => {
  const env = {};
  assert.equal(ok("[ok]", pipe, env), "[ok]");
  const painted = ok("[ok]", tty, env);
  assert.match(painted, /^\x1B\[38;5;79m\[ok\]\x1B\[0m$/);
  assert.equal(stripAnsi(painted), "[ok]");
});

test("colorizeHelp only styles section headers and leaves body text intact", () => {
  const help = "Usage:\n  lyt --help\nOptions:\n  -h    Show this help";
  const env = {};
  assert.equal(colorizeHelp(help, pipe, env), help);

  const styled = colorizeHelp(help, tty, env);
  assert.equal(styled.includes(`${ANSI.bold}Usage:${ANSI.reset}`), true);
  assert.equal(styled.includes(`${ANSI.bold}Options:${ANSI.reset}`), true);
  assert.equal(styled.includes("  lyt --help"), true);
  assert.equal(stripAnsi(styled), help);
});

test("supportsUnicode can be forced off and defaults on outside classic Windows consoles", () => {
  assert.equal(supportsUnicode({ LYT_ASCII: "1" }), false);
  assert.equal(supportsUnicode({ TERM: "dumb" }), false);
  if (process.platform === "win32") {
    assert.equal(supportsUnicode({ WT_SESSION: "1" }), true);
    assert.equal(supportsUnicode({}), false);
  } else {
    assert.equal(supportsUnicode({}), true);
  }
});
