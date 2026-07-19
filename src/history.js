// Download history: one JSON object per line (JSONL) in the user data dir.
// Powers instant dedupe ("you already grabbed this one") and the
// `lyt history` subcommand. Append-only, tiny, and trivially greppable.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { dataDir } from "./paths.js";
import { extractVideoId } from "./urls.js";

export function historyPath(dir = dataDir()) {
  return join(dir, "history.jsonl");
}

// Returns all history entries, oldest first. Corrupt lines are skipped so a
// damaged file never breaks downloads.
export function loadHistory(file = historyPath()) {
  if (!existsSync(file)) {
    return [];
  }

  const entries = [];

  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) {
      continue;
    }

    try {
      const entry = JSON.parse(line);

      if (entry && typeof entry === "object") {
        entries.push(entry);
      }
    } catch {
      // Skip corrupt lines.
    }
  }

  return entries;
}

export function recordDownload(entry, file = historyPath()) {
  if (!isAbsolute(file)) {
    throw new Error(`History path must be absolute: ${file}`);
  }

  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    throw new Error(`Could not update history at ${file}: ${error.message}`, {
      cause: error,
    });
  }
}

export function clearHistory(file = historyPath()) {
  rmSync(file, { force: true });
}

export function existingHistoryFiles(entry, exists = existsSync) {
  if (!Array.isArray(entry?.files)) return [];
  return entry.files.filter((file) => typeof file === "string" && exists(file));
}

// Splits URLs into ones not seen before (`fresh`) and ones whose video ID is
// already in history (`skipped`). URLs without an extractable video ID (e.g.
// playlists) are always fresh — we cannot prove they were downloaded.
export function splitByHistory(urls, entries, exists = existsSync) {
  const known = new Set(
    entries
      .filter((entry) =>
        !Array.isArray(entry.files) ||
        entry.files.length === 0 ||
        existingHistoryFiles(entry, exists).length > 0,
      )
      .map((entry) => entry.id)
      .filter((id) => typeof id === "string"),
  );
  const fresh = [];
  const skipped = [];

  for (const url of urls) {
    const id = extractVideoId(url);

    if (id && known.has(id)) {
      skipped.push(url);
    } else {
      fresh.push(url);
    }
  }

  return { fresh, skipped };
}

// Case-insensitive substring search across user-meaningful entry fields.
export function searchHistory(entries, query) {
  const needle = String(query ?? "").toLowerCase();

  if (!needle) {
    return entries;
  }

  const fields = ["id", "url", "mode", "title", "description", "dir", "files", "ts"];

  return entries.filter((entry) =>
    fields
      .map((field) => entry[field])
      .filter((value) => value != null)
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}
