// Public entry: sole router for bins (lyt / yt3 / yt4).
// Subcommands live under src/commands; downloads go through cli.js.

import { handleCliError } from "./errors.js";
import { extractVideoId } from "./urls.js";
import { VALUE_OPTIONS } from "./ytDlp.js";

export { parseHistoryArgs } from "./commandArgs.js";
export { parseInfoArgs } from "./commandArgs.js";

export function runEntry(argv, defaults = {}) {
  return mainEntry(argv, defaults).catch((error) => {
    handleCliError(error, { json: argv.includes("--json") });
  });
}

export async function mainEntry(argv, defaults = {}) {
  if (argv.length === 1 && ["--help", "-h", "--version", "-v"].includes(argv[0])) {
    return (await import("./commands/meta.js")).runMetaCommand(argv[0]);
  }
  switch (argv[0]) {
    case "history":
      return (await import("./commands/history.js")).runHistoryCommand(argv.slice(1));
    case "doctor":
      return (await import("./doctor.js")).runDoctor({
        fix: argv.includes("--fix"),
        update: argv.includes("--update") || argv.includes("-U"),
        checkUpdates: argv.includes("--check-updates"),
        json: argv.includes("--json"),
      });
    case "info":
    case "inspect":
      return (await import("./commands/info.js")).runInfoCommand(argv.slice(1));
    case "capabilities":
      return (await import("./commands/capabilities.js")).runCapabilitiesCommand(argv.slice(1));
    case "config":
      return (await import("./commands/config.js")).runConfigCommand(argv.slice(1));
    case "agent":
      return (await import("./commands/agent.js")).runAgentCommand(argv.slice(1));
    default:
      return (await import("./cli.js")).run(prepareDownloadArgv(argv), defaults);
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
