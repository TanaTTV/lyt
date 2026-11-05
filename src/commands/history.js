// `lyt history` — list, search, or clear local download history.
// Public JSON contract: lyt.history.v1

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";
import { usageError } from "../errors.js";
import {
  clearHistory,
  existingHistoryFiles,
  historyPath,
  loadHistory,
  searchHistory,
} from "../history.js";
import { muted, ok } from "../ui.js";
import { VERSION } from "../version.js";

import { parseHistoryArgs } from "../commandArgs.js";
export { parseHistoryArgs } from "../commandArgs.js";

export function runHistoryCommand(argv) {
  const options = parseHistoryArgs(argv);

  if (options.clear) {
    clearHistory();
    if (options.json) {
      console.log(JSON.stringify({
        schema: "lyt.history.v1",
        version: VERSION,
        command: "history.clear",
        ok: true,
        path: historyPath(),
      }));
    } else {
      console.log(ok("Download history cleared.", process.stdout));
    }
    return;
  }

  const entries = searchHistory(loadHistory(), options.query);
  const visible = entries.slice(-options.limit);

  if (options.json) {
    console.log(JSON.stringify({
      schema: "lyt.history.v1",
      version: VERSION,
      command: "history.list",
      ok: true,
      query: options.query,
      total: entries.length,
      entries: visible,
      path: historyPath(),
    }));
    return;
  }

  if (entries.length === 0) {
    console.log(options.query
      ? `No history entries match "${options.query}".`
      : "No downloads recorded yet.");
    console.log(muted(`(history file: ${historyPath()})`, process.stdout));
    return;
  }

  for (const entry of visible) {
    const when = String(entry.ts ?? "").replace("T", " ").slice(0, 16);
    const mode = (entry.mode ?? "?").padEnd(5);
    const source = entry.url ?? entry.id ?? "?";
    const label = entry.title ? `${entry.title}  ${muted(source, process.stdout)}` : source;
    console.log(`${muted(when, process.stdout)}  ${mode}  ${label}`);
  }

  if (entries.length > options.limit) {
    console.log(muted(`(${entries.length - options.limit} older entries not shown - use --limit <n>)`, process.stdout));
  }
}

export const LAST_USAGE = "Usage: lyt last [query] [--json] [--open | --reveal]";

export function parseLastArgs(argv) {
  const options = { json: false, open: false, reveal: false, help: false, query: "" };
  const words = [];
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--open") options.open = true;
    else if (arg === "--reveal") options.reveal = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("-")) throw usageError(`Unknown last option: ${arg}`);
    else words.push(arg);
  }
  if (options.open && options.reveal) throw usageError("Use --open or --reveal, not both.");
  options.query = words.join(" ");
  return options;
}

// The command that shows a file (or its folder) with the desktop's default app.
export function openerFor(file, { reveal = false, platform = process.platform } = {}) {
  if (platform === "darwin") return { command: "open", args: reveal ? ["-R", file] : [file] };
  if (platform === "win32") {
    return { command: "explorer.exe", args: reveal ? [`/select,${file}`] : [file] };
  }
  return { command: "xdg-open", args: [reveal ? dirname(file) : file] };
}

// `lyt last` — the most recent download's files: print, open, or reveal.
export function runLastCommand(argv, {
  entries = loadHistory(), log = console.log, launch = launchDetached, exists = existsSync,
} = {}) {
  const options = parseLastArgs(argv);
  if (options.help) { log(LAST_USAGE); return; }

  const entry = searchHistory(entries, options.query)
    .filter((candidate) => existingHistoryFiles(candidate, exists).length > 0)
    .at(-1);

  if (!entry) {
    const error = new Error(options.query
      ? `No downloaded files on disk match "${options.query}".`
      : "No downloaded files on disk yet (history may be off, or the files were moved).");
    error.exitCode = 1;
    error.kind = "no_output";
    if (options.json) {
      log(JSON.stringify({
        schema: "lyt.history.v1", version: VERSION, command: "history.last", ok: false,
        query: options.query, total: 0, entries: [], path: historyPath(),
      }));
      error.jsonPrinted = true;
    }
    throw error;
  }

  const files = existingHistoryFiles(entry, exists);
  if (options.json) {
    log(JSON.stringify({
      schema: "lyt.history.v1", version: VERSION, command: "history.last", ok: true,
      query: options.query, total: 1, entries: [{ ...entry, files }], path: historyPath(),
    }));
  } else {
    for (const file of files) log(file);
  }

  if (options.open || options.reveal) {
    const { command, args } = openerFor(files[0], { reveal: options.reveal });
    launch(command, args);
  }
}

function launchDetached(command, args) {
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", (error) => {
    console.error(`Could not open the file with ${command}: ${error.message}`);
  });
  child.unref();
}
