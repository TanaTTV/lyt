// `lyt agent install` — install packaged skills for coding agents.

import { resolve } from "node:path";
import { installAgentSkills } from "../agent.js";
import { usageError } from "../errors.js";

export function runAgentCommand(argv) {
  const [action = "install", ...args] = argv;

  if (action !== "install") {
    throw usageError("Usage: lyt agent install [codex|claude|all] [--home <dir>]");
  }

  let target = "all";
  let home;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--home") {
      if (!args[index + 1]) throw usageError("--home requires a directory");
      home = resolve(args[++index]);
    } else if (["codex", "claude", "all"].includes(args[index])) {
      target = args[index];
    } else {
      throw usageError(`Unknown agent install option: ${args[index]}`);
    }
  }

  const installed = installAgentSkills(target, { home });
  for (const { agent, destination } of installed) {
    console.log(`Installed lyt skill for ${agent}: ${destination}`);
  }
}
