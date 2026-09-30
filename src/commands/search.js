import process from "node:process";
import { ensureYtDlp } from "../bootstrap.js";
import { usageError } from "../errors.js";
import { errorDetails } from "../result.js";
import { searchMedia } from "../search.js";
import { VERSION } from "../version.js";

export const SEARCH_USAGE = 'Usage: lyt search "query" [--limit 1-25] [--json] [--no-download]';

export function parseSearchArgs(argv) {
  const words = [];
  let limit = 5;
  let json = false;
  let noDownload = false;
  let help = false;
  let positional = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!positional && arg === "--") { positional = true; continue; }
    if (!positional && arg === "--json") { json = true; continue; }
    if (!positional && arg === "--no-download") { noDownload = true; continue; }
    if (!positional && ["--help", "-h"].includes(arg)) { help = true; continue; }
    if (!positional && arg === "--limit") {
      const value = argv[++index];
      if (!/^\d+$/.test(value ?? "") || Number(value) < 1 || Number(value) > 25) {
        throw usageError("Search --limit must be an integer from 1 to 25.");
      }
      limit = Number(value);
      continue;
    }
    if (!positional && arg.startsWith("-")) throw usageError(`Unknown search option: ${arg}`);
    words.push(arg);
  }
  const query = words.join(" ").trim();
  if (!help && (!query || query.length > 500)) throw usageError("Search needs a query of 1-500 characters.");
  return { query, limit, json, noDownload, help };
}

export async function runSearchCommand(argv, {
  ensureTool = ensureYtDlp, search = searchMedia, log = console.log,
} = {}) {
  const options = parseSearchArgs(argv);
  if (options.help) { log(SEARCH_USAGE); return; }
  try {
    const command = await ensureTool({ noDownload: options.noDownload || process.env.LYT_NO_DOWNLOAD === "1" });
    const results = await search(options.query, { command, limit: options.limit });
    if (options.json) {
      log(JSON.stringify({ schema: "lyt.search.v1", version: VERSION, command: "search",
        ok: true, query: options.query, limit: options.limit, results }));
    } else {
      for (const result of results) {
        const duration = result.durationSeconds == null ? "duration unknown" : `${Math.floor(result.durationSeconds / 60)}:${String(Math.floor(result.durationSeconds % 60)).padStart(2, "0")}`;
        log(`${result.index}. ${result.title}\n   ${result.uploader ?? "Unknown channel"} · ${duration}${result.isLive ? " · LIVE" : result.isUpcoming ? " · UPCOMING" : ""}\n   ${result.url}`);
      }
      if (results.length === 0) log("No results found.");
    }
  } catch (error) {
    if (options.json) {
      log(JSON.stringify({ schema: "lyt.search.v1", version: VERSION, command: "search",
        ok: false, query: options.query, limit: options.limit, results: [], error: errorDetails(error) }));
      error.jsonPrinted = true;
    }
    throw error;
  }
}
