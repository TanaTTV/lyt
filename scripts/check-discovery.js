import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const json = (path) => JSON.parse(read(path));
const pkg = json("package.json");
for (const path of ["plugins/lyt/.codex-plugin/plugin.json", "plugins/lyt/.claude-plugin/plugin.json"]) {
  assert.equal(json(path).version, pkg.version, `${path}: release version`);
}
assert.equal(json(".claude-plugin/marketplace.json").plugins[0].version, pkg.version);
const skill = read("skills/lyt/SKILL.md");
for (const path of [".agents/skills/lyt/SKILL.md", ".claude/skills/lyt/SKILL.md", "plugins/lyt/skills/lyt/SKILL.md"]) assert.equal(read(path), skill, `${path}: canonical skill`);
assert.ok(read("CHANGELOG.md").includes(`## [${pkg.version}]`), "release changelog entry");
assert.ok(read("README.md").includes(`"version": "${pkg.version}"`), "README result version");
assert.ok(pkg.files.includes("AI.md"), "AI reference must ship on npm");
const metadata = json("plugins/lyt/.codex-plugin/plugin.json").interface;
assert.ok(metadata.shortDescription.length <= 30, "directory subtitle limit");
for (const key of ["logo", "composerIcon"]) assert.ok(existsSync(join(root, "plugins/lyt", metadata[key])), `${key}: included asset`);
const cases = json("evals/skill-selection.json");
assert.ok(cases.some(c => c.should_trigger) && cases.some(c => !c.should_trigger), "positive and negative evaluation cases");
assert.ok(cases.every(c => !/\blyt\b/i.test(c.prompt)), "implicit invocation cases must not name lyt");
console.log(`Discovery release checks passed for lyt ${pkg.version}.`);
