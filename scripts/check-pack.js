import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : npm;
const args = npmCli ? [npmCli, "pack", "--dry-run", "--json"] : ["pack", "--dry-run", "--json"];
const packed = spawnSync(command, args, {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  encoding: "utf8",
});

if (packed.status !== 0) {
  process.stderr.write(packed.stderr || packed.stdout || packed.error?.message || "npm pack failed");
  process.exit(packed.status || 1);
}

const packResult = JSON.parse(packed.stdout);
const report = Array.isArray(packResult)
  ? packResult[0]
  : Object.values(packResult ?? {})[0];
const { files = [] } = report ?? {};
const paths = new Set(files.map((file) => file.path));
const required = [
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "bin/lyt.js",
  "src/cli.js",
  "skills/lyt/SKILL.md",
  "schemas/lyt.result.v1.schema.json",
];
const forbiddenPrefixes = ["reports/", "test/", "app/", ".github/", ".claude/"];
const missing = required.filter((path) => !paths.has(path));
const forbidden = [...paths].filter((path) =>
  forbiddenPrefixes.some((prefix) => path.startsWith(prefix)),
);

if (missing.length || forbidden.length) {
  if (missing.length) process.stderr.write(`Missing package files: ${missing.join(", ")}\n`);
  if (forbidden.length) process.stderr.write(`Unexpected package files: ${forbidden.join(", ")}\n`);
  process.exit(1);
}

process.stdout.write(`Package contents verified (${paths.size} files).\n`);
