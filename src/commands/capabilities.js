// `lyt capabilities` — static product surface for agents.
// Public JSON contract: lyt.capabilities.v1

import process from "node:process";
import { buildCapabilities } from "../capabilities.js";
import { usageError } from "../errors.js";
import { heading, muted } from "../ui.js";

export function runCapabilitiesCommand(argv) {
  const unknown = argv.find((arg) => arg.startsWith("-") && arg !== "--json");
  if (unknown) {
    throw usageError(`Unknown capabilities option: ${unknown}`);
  }

  const payload = buildCapabilities();

  if (argv.includes("--json")) {
    console.log(JSON.stringify(payload));
    return;
  }

  const stream = process.stdout;
  console.log(heading(`lyt ${payload.version} (node ${payload.node})`, stream));
  console.log("");
  console.log(`${muted("commands:", stream)}  ${payload.commands.join(", ")}`);
  console.log(`${muted("modes:", stream)}     ${payload.modes.join(", ")}`);
  console.log(`${muted("profiles:", stream)}  ${payload.profiles.join(", ")}`);
  console.log(`${muted("schemas:", stream)}   ${payload.schemas.join(", ")}`);
  console.log("");
  console.log(heading("exit codes:", stream));
  for (const [code, meaning] of Object.entries(payload.exitCodes)) {
    console.log(`  ${code}  ${meaning}`);
  }
  console.log("");
  console.log(heading("options:", stream));
  for (const option of payload.options) {
    const marker = option.takesValue ? " <value>" : "";
    console.log(`  ${option.flag}${marker}`.padEnd(26) + option.summary);
  }
  console.log("");
  console.log(muted("Run `lyt capabilities --json` for the machine-readable manifest.", stream));
}
