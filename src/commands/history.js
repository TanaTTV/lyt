// `lyt history` — list, search, or clear local download history.
// Public JSON contract: lyt.history.v1

import {
  clearHistory,
  historyPath,
  loadHistory,
  searchHistory,
} from "../history.js";
import { usageError } from "../errors.js";
import { VERSION } from "../version.js";

export function parseHistoryArgs(argv) {
  let clear = false;
  let json = false;
  let limit = 20;
  const query = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--clear") {
      clear = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--limit") {
      const raw = argv[++index];
      if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) < 1) {
        throw usageError("--limit requires a positive integer");
      }
      limit = Number(raw);
      continue;
    }

    if (arg.startsWith("-")) {
      throw usageError(`Unknown history option: ${arg}`);
    }

    query.push(arg);
  }

  if (clear && query.length > 0) {
    throw usageError("lyt history --clear cannot be combined with a search query");
  }

  return { clear, json, limit, query: query.join(" ") };
}

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
      console.log("Download history cleared.");
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
    console.log(`(history file: ${historyPath()})`);
    return;
  }

  for (const entry of visible) {
    const when = String(entry.ts ?? "").replace("T", " ").slice(0, 16);
    const mode = (entry.mode ?? "?").padEnd(5);
    console.log(`${when}  ${mode}  ${entry.url ?? entry.id ?? "?"}`);
  }

  if (entries.length > options.limit) {
    console.log(`(${entries.length - options.limit} older entries not shown - use --limit <n>)`);
  }
}
