// `lyt transcript <url>` — subtitles or automatic captions as clean text.
// Public JSON contract: lyt.transcript.v1

import process from "node:process";
import { ensureYtDlp, ytDlpPolicy } from "../bootstrap.js";
import { loadConfig } from "../config.js";
import { usageError } from "../errors.js";
import { errorDetails } from "../result.js";
import { fetchTranscript, formatTimestamp } from "../transcript.js";
import { VERSION } from "../version.js";

export const TRANSCRIPT_USAGE =
  "Usage: lyt transcript <url> [--lang en] [--timestamps] [--json] [--no-download]";

export function parseTranscriptArgs(argv) {
  const options = { url: null, language: "en", timestamps: false, json: false, noDownload: false, help: false };
  let positional = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!positional && arg === "--") { positional = true; continue; }
    if (!positional && arg === "--json") { options.json = true; continue; }
    if (!positional && arg === "--timestamps") { options.timestamps = true; continue; }
    if (!positional && arg === "--no-download") { options.noDownload = true; continue; }
    if (!positional && ["--help", "-h"].includes(arg)) { options.help = true; continue; }
    if (!positional && (arg === "--lang" || arg === "--language")) {
      const value = argv[++index];
      if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value ?? "")) {
        throw usageError("--lang needs a language code such as en, es, or pt-BR.");
      }
      options.language = value;
      continue;
    }
    if (!positional && arg.startsWith("-")) throw usageError(`Unknown transcript option: ${arg}`);
    if (options.url) throw usageError("lyt transcript takes one URL at a time.");
    options.url = arg;
  }
  if (!options.help && !options.url) throw usageError(TRANSCRIPT_USAGE);
  return options;
}

export async function runTranscriptCommand(argv, {
  ensureTool = ensureYtDlp, transcript = fetchTranscript, log = console.log,
} = {}) {
  const options = parseTranscriptArgs(argv);
  if (options.help) { log(TRANSCRIPT_USAGE); return; }
  const envelope = { schema: "lyt.transcript.v1", version: VERSION, command: "transcript", url: options.url };
  try {
    const command = await ensureTool({
      noDownload: options.noDownload || process.env.LYT_NO_DOWNLOAD === "1",
      ...ytDlpPolicy(loadConfig()),
    });
    const result = await transcript(options.url, { command, language: options.language });
    if (options.json) {
      log(JSON.stringify({ ...envelope, ok: true, ...result }));
    } else if (options.timestamps) {
      for (const segment of result.segments) log(`[${formatTimestamp(segment.start)}] ${segment.text}`);
    } else {
      log(result.text);
    }
  } catch (error) {
    if (options.json) {
      log(JSON.stringify({ ...envelope, ok: false, error: errorDetails(error) }));
      error.jsonPrinted = true;
    }
    throw error;
  }
}
