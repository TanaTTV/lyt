import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VERSION } from "../src/version.js";

test("CLI version comes from package.json", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(VERSION, packageJson.version);
});
