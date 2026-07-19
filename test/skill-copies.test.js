import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("project and packaged agent skills stay identical", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const packaged = read("../skills/lyt/SKILL.md");

  assert.equal(read("../.agents/skills/lyt/SKILL.md"), packaged);
  assert.equal(read("../.claude/skills/lyt/SKILL.md"), packaged);
});
