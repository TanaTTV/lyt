// Tiny TTY styling. No dependencies. JSON/agent paths stay unstyled:
// color only applies when the destination stream is an interactive terminal
// (or FORCE_COLOR is set) and never when NO_COLOR or TERM=dumb is set.

import process from "node:process";

const ANSI = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  red: "\x1B[38;5;197m",
  green: "\x1B[38;5;79m",
  yellow: "\x1B[38;5;221m",
  cyan: "\x1B[38;5;45m",
};

const ANSI_PATTERN = /\x1B\[[0-9;]*m/g;

export function colorEnabled(stream = process.stderr, env = process.env) {
  if (env.NO_COLOR != null && env.NO_COLOR !== "") return false;
  if (env.FORCE_COLOR === "0") return false;
  if (env.TERM === "dumb") return false;
  if (env.FORCE_COLOR != null && env.FORCE_COLOR !== "") return true;
  return Boolean(stream?.isTTY);
}

export function supportsUnicode(env = process.env) {
  if (env.LYT_ASCII === "1") return false;
  if (env.TERM === "dumb") return false;
  if (process.platform !== "win32") return true;
  return Boolean(
    env.WT_SESSION ||
    env.TERM_PROGRAM ||
    env.ConEmuANSI ||
    (env.TERM && /xterm|vt100|vt220|rxvt|alacritty|tmux/i.test(env.TERM)),
  );
}

export function paint(text, code, stream = process.stderr, env = process.env) {
  if (!code || !colorEnabled(stream, env)) return String(text);
  return `${code}${text}${ANSI.reset}`;
}

export function heading(text, stream = process.stdout, env = process.env) {
  return paint(text, ANSI.bold, stream, env);
}

export function accent(text, stream = process.stderr, env = process.env) {
  return paint(text, ANSI.red, stream, env);
}

export function ok(text, stream = process.stderr, env = process.env) {
  return paint(text, ANSI.green, stream, env);
}

export function err(text, stream = process.stderr, env = process.env) {
  return paint(text, ANSI.red, stream, env);
}

export function warn(text, stream = process.stderr, env = process.env) {
  return paint(text, ANSI.yellow, stream, env);
}

export function muted(text, stream = process.stderr, env = process.env) {
  return paint(text, ANSI.dim, stream, env);
}

export function colorizeHelp(text, stream = process.stdout, env = process.env) {
  if (!colorEnabled(stream, env)) return text;
  return text
    .split("\n")
    .map((line) => (/^[A-Z].*:$/.test(line) ? heading(line, stream, env) : line))
    .join("\n");
}

export function stripAnsi(text) {
  return String(text).replace(ANSI_PATTERN, "");
}

export { ANSI };
