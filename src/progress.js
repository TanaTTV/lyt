// Parsing and rendering of yt-dlp's `--newline --progress` output.
//
// `parseProgressLine` is pure (no I/O) so it can be unit-tested without a
// terminal. `createProgressRenderer` owns a fixed block of terminal rows and
// redraws one aggregated bar per download, which fixes the garbled output you
// get when several `--jobs` workers write to the same TTY through inherited
// stdio. A single download uses the same bar, rewritten in place, and lets
// non-progress yt-dlp lines print above it.

import { basename } from "node:path";
import { ANSI, colorEnabled, muted, supportsUnicode } from "./ui.js";

const PERCENT = /\[download\]\s+([\d.]+)%/;
const SPEED = /at\s+([\d.]+\s*\w+\/s)/;
const ETA = /ETA\s+([\d:]+)/;
const DESTINATION = /^\[download\] Destination:\s+(.+)$/;

export function parseProgressLine(line) {
  const destination = DESTINATION.exec(line);

  if (destination) {
    return { destination: destination[1] };
  }

  const percent = PERCENT.exec(line);

  if (percent) {
    return {
      percent: Number(percent[1]),
      speed: SPEED.exec(line)?.[1],
      eta: ETA.exec(line)?.[1],
    };
  }

  if (line.includes("[ExtractAudio]")) {
    return { percent: 100, stage: "convert" };
  }

  return null;
}

export function createProgressRenderer(labels, {
  out = process.stderr,
  color,
  unicode,
} = {}) {
  const isTTY = Boolean(out.isTTY);
  const useColor = color ?? colorEnabled(out);
  const useUnicode = unicode ?? (isTTY && supportsUnicode());
  const inplace = labels.length === 1;
  const state = labels.map((label) => ({
    label,
    percent: 0,
    detail: "",
    finished: false,
  }));
  let painted = false;

  if (isTTY && !inplace) {
    // Reserve one row per download so the cursor can move back up over them.
    for (let i = 0; i < state.length; i += 1) {
      out.write("\n");
    }
  }

  function barOptions() {
    return { color: useColor, unicode: useUnicode };
  }

  function render() {
    if (!isTTY) {
      return;
    }

    if (inplace) {
      out.write(`\r\x1B[2K${formatBar(state[0], barOptions())}`);
      painted = true;
      return;
    }

    out.write(`\x1B[${state.length}A`);

    for (const entry of state) {
      out.write(`\x1B[2K${formatBar(entry, barOptions())}\n`);
    }
  }

  return {
    update(index, info) {
      const entry = state[index];

      if (!entry || entry.finished) {
        return;
      }

      if (info.destination) {
        const name = basename(info.destination);
        if (name) entry.label = name;
        return;
      }

      if (typeof info.percent === "number") {
        entry.percent = info.percent;
      }

      entry.detail = info.stage === "convert"
        ? "converting"
        : [info.speed, info.eta ? `ETA ${info.eta}` : null].filter(Boolean).join("  ");

      render();
    },

    note(line) {
      if (!isTTY || !inplace || !line) {
        return;
      }

      if (painted) out.write("\r\x1B[2K");
      out.write(`${useColor ? muted(line, out) : line}\n`);
      painted = false;

      if (state[0].percent > 0 || state[0].detail) {
        render();
      }
    },

    done(index, ok) {
      const entry = state[index];

      if (!entry) {
        return;
      }

      entry.finished = true;
      entry.percent = ok ? 100 : entry.percent;
      entry.detail = ok ? "done" : "failed";

      if (!isTTY) {
        out.write(`${entry.label}: ${ok ? "done" : "failed"}\n`);
        return;
      }

      render();

      if (inplace) {
        out.write("\n");
        painted = false;
      }
    },

    finish() {
      if (inplace) {
        if (painted) out.write("\n");
        painted = false;
        return;
      }

      render();
    },
  };
}

export function formatBar(entry, { color = false, unicode = false } = {}) {
  const width = 24;
  const clamped = Math.max(0, Math.min(100, entry.percent));
  const filled = Math.round((clamped / 100) * width);
  const fillChar = unicode ? "█" : "#";
  const emptyChar = unicode ? "░" : "-";
  const rawBar = fillChar.repeat(filled) + emptyChar.repeat(width - filled);
  const pct = String(Math.round(clamped)).padStart(3);
  const name = entry.label.length > 28 ? `${entry.label.slice(0, 27)}…` : entry.label.padEnd(28);
  const failed = entry.detail === "failed";
  const done = entry.detail === "done";
  const converting = entry.detail === "converting";

  let bar = rawBar;
  let detail = entry.detail;

  if (color) {
    const tone = failed ? ANSI.red : done ? ANSI.green : converting ? ANSI.yellow : ANSI.cyan;
    bar = `${tone}${rawBar}${ANSI.reset}`;
    if (done) detail = `${ANSI.green}${detail}${ANSI.reset}`;
    else if (failed) detail = `${ANSI.red}${detail}${ANSI.reset}`;
    else if (converting) detail = `${ANSI.yellow}${detail}${ANSI.reset}`;
    else if (detail) detail = `${ANSI.dim}${detail}${ANSI.reset}`;
  }

  return `${name} [${bar}] ${pct}%  ${detail}`.trimEnd();
}
