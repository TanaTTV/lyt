import test from "node:test";
import assert from "node:assert/strict";
import { buildCapabilities, OPTIONS, SCHEMAS } from "../src/capabilities.js";
import { profileNames } from "../src/config.js";
import { parseArgs } from "../src/ytDlp.js";
import { VERSION } from "../src/version.js";

test("buildCapabilities describes the lyt.capabilities.v1 contract", () => {
  const capabilities = buildCapabilities();

  assert.equal(capabilities.schema, "lyt.capabilities.v1");
  assert.equal(capabilities.command, "capabilities");
  assert.equal(capabilities.ok, true);
  assert.equal(capabilities.version, VERSION);
  assert.equal(typeof capabilities.node, "string");
  assert.ok(capabilities.commands.includes("info"));
  assert.ok(capabilities.commands.includes("capabilities"));
  assert.deepEqual(capabilities.profiles, profileNames());
  assert.ok(SCHEMAS.includes("lyt.result.v1"));
  assert.ok(SCHEMAS.includes("lyt.info.v1"));
  assert.equal(capabilities.exitCodes["2"], "usage or validation error");
});

test("every advertised option is recognized by the argument parser", () => {
  // parseArgs throws an exit-code-2 "Unknown option" error for flags it does
  // not recognize. Parsing each advertised flag (with a value when required)
  // must succeed, keeping the capabilities manifest in sync with the parser.
  for (const option of OPTIONS) {
    const argv = option.takesValue
      ? [option.flag, "value", "https://example.com/watch?v=abc"]
      : [option.flag, "https://example.com/watch?v=abc"];

    assert.doesNotThrow(
      () => parseArgs(argv),
      `${option.flag} should be a recognized flag`,
    );
  }
});

test("advertised value flags consume their argument", () => {
  for (const option of OPTIONS.filter((entry) => entry.takesValue)) {
    assert.throws(
      () => parseArgs([option.flag]),
      /needs a value/,
      `${option.flag} should require a value`,
    );
  }
});
