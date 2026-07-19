import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentSkillPath, installAgentSkills } from "../src/agent.js";

test("resolves Codex and Claude skill destinations", () => {
  assert.equal(agentSkillPath("codex", "C:/Users/Test"), join("C:/Users/Test", ".codex", "skills", "lyt", "SKILL.md"));
  assert.equal(agentSkillPath("claude", "C:/Users/Test"), join("C:/Users/Test", ".claude", "skills", "lyt", "SKILL.md"));
  assert.throws(() => agentSkillPath("other", "C:/Users/Test"), /Unknown agent/);
});
test("installs the packaged skill for both supported agents", () => {
  const home = mkdtempSync(join(tmpdir(), "lyt-agent-"));

  try {
    const installed = installAgentSkills("all", { home });
    assert.deepEqual(installed.map((item) => item.agent), ["codex", "claude"]);
    for (const { destination } of installed) {
      assert.match(readFileSync(destination, "utf8"), /schema `lyt\.result\.v1`/);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
