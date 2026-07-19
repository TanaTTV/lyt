import { copyFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SUPPORTED_AGENTS = new Set(["codex", "claude"]);
const SKILL_SOURCE = new URL("../skills/lyt/SKILL.md", import.meta.url);

export function agentSkillPath(agent, home = homedir()) {
  if (!SUPPORTED_AGENTS.has(agent)) {
    const error = new Error(`Unknown agent: ${agent}. Use codex, claude, or all.`);
    error.exitCode = 2;
    throw error;
  }

  const root = agent === "codex" ? ".codex" : ".claude";
  return join(home, root, "skills", "lyt", "SKILL.md");
}
export function installAgentSkills(target = "all", {
  home = homedir(),
  copyFile = copyFileSync,
  makeDirectory = mkdirSync,
} = {}) {
  const agents = target === "all" ? ["codex", "claude"] : [target];

  return agents.map((agent) => {
    const destination = agentSkillPath(agent, home);
    makeDirectory(dirname(destination), { recursive: true });
    copyFile(SKILL_SOURCE, destination);
    return { agent, destination };
  });
}
