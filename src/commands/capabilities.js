// `lyt capabilities` — static product surface for agents.
// Public JSON contract: lyt.capabilities.v1

import { buildCapabilities } from "../capabilities.js";
import { usageError } from "../errors.js";

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

  console.log(`lyt ${payload.version} (node ${payload.node})`);
  console.log("");
  console.log(`commands:  ${payload.commands.join(", ")}`);
  console.log(`modes:     ${payload.modes.join(", ")}`);
  console.log(`profiles:  ${payload.profiles.join(", ")}`);
  console.log(`schemas:   ${payload.schemas.join(", ")}`);
  console.log("");
  console.log("exit codes:");
  for (const [code, meaning] of Object.entries(payload.exitCodes)) {
    console.log(`  ${code}  ${meaning}`);
  }
  console.log("");
  console.log("options:");
  for (const option of payload.options) {
    const marker = option.takesValue ? " <value>" : "";
    console.log(`  ${option.flag}${marker}`.padEnd(26) + option.summary);
  }
  console.log("");
  console.log("Run `lyt capabilities --json` for the machine-readable manifest.");
}
