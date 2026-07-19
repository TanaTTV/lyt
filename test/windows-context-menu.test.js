import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../install/windows-context-menu.ps1", import.meta.url), "utf8");
const handler = readFileSync(new URL("../install/windows-context-menu-handler.ps1", import.meta.url), "utf8");

test("context-menu target is passed as a native argument, not PowerShell source", () => {
  assert.doesNotMatch(script, /-Command\s+"Set-Location[^\n]*%V/);
  assert.match(script, /-File\s+"'/);
  assert.match(script, /-TargetPath\s+"%V"/);
  assert.match(script, /-ToolPath\s+"'/);
  assert.match(script, /Copy-Item[^\n]*windows-context-menu-handler\.ps1/s);
  assert.match(handler, /Set-Location -LiteralPath \$TargetPath/);
  assert.match(handler, /& \$ToolPath --paste/);
  assert.doesNotMatch(handler, /-Command/);
});
