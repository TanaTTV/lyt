// Public entry: sole router for bins (lyt / yt3 / yt4).
// Subcommands live under src/commands; downloads go through cli.js.

import process from "node:process";
import { run } from "./cli.js";
import { runAgentCommand } from "./commands/agent.js";
import { runCapabilitiesCommand } from "./commands/capabilities.js";
import { runConfigCommand } from "./commands/config.js";
import { runHistoryCommand } from "./commands/history.js";
import { runInfoCommand } from "./commands/info.js";
import { runDoctor } from "./doctor.js";
import { handleCliError } from "./errors.js";
import { extractVideoId } from "./urls.js";
import { VALUE_OPTIONS } from "./ytDlp.js";

export { parseHistoryArgs } from "./commands/history.js";
export { parseInfoArgs } from "./commands/info.js";

export function runEntry(argv, defaults = {}) {
  return mainEntry(argv, defaults).catch((error) => {
    handleCliError(error, { json: argv.includes("--json") });
  });
}

export async function mainEntry(argv, defaults = {}) {
  switch (argv[0]) {
    case "history":
      return runHistoryCommand(argv.slice(1));
    case "doctor":
      return runDoctor({
        fix: argv.includes("--fix"),
        update: argv.includes("--update") || argv.includes("-U"),
        json: argv.includes("--json"),
      });
    case "info":
    case "inspect":
      return runInfoCommand(argv.slice(1));
    case "capabilities":
      return runCapabilitiesCommand(argv.slice(1));
    case "config":
      return runConfigCommand(argv.slice(1));
    case "agent":
      return runAgentCommand(argv.slice(1));
    default:
      return run(prepareDownloadArgv(argv), defaults);
  }
}

export function prepareDownloadArgv(argv) {
  const json = argv.includes("--json");
  const prepared = json
    ? argv.filter((arg) => arg !== "--print-command")
    : [...argv];

  // An explicit overwrite request cannot take effect if history skips the job
  // first. Insert the dedupe override before `--`, which marks the URL boundary.
  if (prepared.includes("--force-overwrite") && !prepared.includes("--redownload")) {
    const marker = prepared.indexOf("--");
    if (marker >= 0) prepared.splice(marker, 0, "--redownload");
    else prepared.push("--redownload");
  }

  return dedupePositionalUrls(prepared);
}

export function dedupePositionalUrls(argv) {
  const result = [];
  const seen = new Set();
  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      positionalOnly = true;
      result.push(arg);
      continue;
    }

    if (!positionalOnly && VALUE_OPTIONS.has(arg)) {
      result.push(arg);
      if (argv[index + 1] !== undefined) result.push(argv[++index]);
      continue;
    }

    if (!positionalOnly && arg.startsWith("-")) {
      result.push(arg);
      continue;
    }

    const key = extractVideoId(arg) ?? arg;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(arg);
    }
  }

  return result;
}
