import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("Codex and Claude marketplace entries publish the current lyt plugin", () => {
  const packageJson = readJson("../package.json");
  const codexMarketplace = readJson("../.agents/plugins/marketplace.json");
  const codexPlugin = readJson("../plugins/lyt/.codex-plugin/plugin.json");
  const claudeMarketplace = readJson("../.claude-plugin/marketplace.json");
  const claudePlugin = readJson("../plugins/lyt/.claude-plugin/plugin.json");

  assert.equal(codexMarketplace.plugins[0].name, "lyt");
  assert.equal(codexMarketplace.plugins[0].source.path, "./plugins/lyt");
  assert.equal(claudeMarketplace.plugins[0].name, "lyt");
  assert.equal(claudeMarketplace.plugins[0].source, "./plugins/lyt");
  assert.equal(codexPlugin.version, packageJson.version);
  assert.equal(claudePlugin.version, packageJson.version);
  assert.equal(claudeMarketplace.plugins[0].version, packageJson.version);
});
