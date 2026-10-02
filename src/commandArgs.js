// Lightweight subcommand parsers shared with the public entry point.
import { usageError } from "./errors.js";

export function parseInfoArgs(argv) {
  let json = false;
  let noDownload = false;
  let jobs = 3;
  const urls = [];
  let positionalOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (positionalOnly) { urls.push(arg); continue; }
    if (arg === "--") { positionalOnly = true; continue; }
    if (arg === "--json") { json = true; continue; }
    if (arg === "--no-download") { noDownload = true; continue; }
    if (arg === "--jobs" || arg === "-j") {
      const raw = argv[++index];
      if (raw === undefined || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > 16) {
        throw usageError("info --jobs requires an integer from 1 to 16");
      }
      jobs = Number(raw);
      continue;
    }
    if (arg.startsWith("-")) throw usageError(`Unknown info option: ${arg}`);
    urls.push(arg);
  }
  return { json, noDownload, jobs, urls };
}

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

