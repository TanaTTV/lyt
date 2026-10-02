// `lyt history` — list, search, or clear local download history.
// Public JSON contract: lyt.history.v1

import process from "node:process";
import {
  clearHistory,
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
