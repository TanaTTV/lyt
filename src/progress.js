// Parsing and rendering of yt-dlp's `--newline --progress` output.
//
// `parseProgressLine` is pure (no I/O) so it can be unit-tested without a
// terminal. `createProgressRenderer` owns a fixed block of terminal rows and
// redraws one aggregated bar per download, which fixes the garbled output you
// get when several `--jobs` workers write to the same TTY through inherited
// stdio.

const PERCENT = /\[download\]\s+([\d.]+)%/;
const SPEED = /at\s+([\d.]+\s*\w+\/s)/;
const ETA = /ETA\s+([\d:]+)/;

export function parseProgressLine(line) {
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

export function createProgressRenderer(labels, { out = process.stderr } = {}) {
  const isTTY = Boolean(out.isTTY);
  const state = labels.map((label) => {
    // Pre-compute the fixed-width display name once so formatBar never
    // allocates during the hot render loop.
    const name = label.length > 28 ? `${label.slice(0, 27)}…` : label.padEnd(28);
    return { label, name, percent: 0, detail: "", finished: false };
  });

  if (isTTY) {
    // Reserve one row per download so the cursor can move back up over them.
    for (let i = 0; i < state.length; i += 1) {
      out.write("\n");
    }
  }

  function render() {
    if (!isTTY) {
      return;
    }

    // Build the entire frame as one string and issue a single write() call.
    // N+1 write() calls per frame (one cursor-up + one per bar) are replaced
    // by a single syscall, which matters when many downloads update in lockstep.
    let buf = `\x1B[${state.length}A`;

    for (const entry of state) {
      buf += `\x1B[2K${formatBar(entry)}\n`;
    }

    out.write(buf);
  }

  return {
    update(index, info) {
      const entry = state[index];

      if (!entry || entry.finished) {
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
    },

    finish() {
      render();
    },
  };
}

function formatBar({ name, percent, detail }) {
  const width = 24;
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const bar = "#".repeat(filled) + "-".repeat(width - filled);
  const pct = String(Math.round(clamped)).padStart(3);

  return `${name} [${bar}] ${pct}%  ${detail}`.trimEnd();
}
