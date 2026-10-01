// Verify a clean npm package installation on Windows, macOS, and Linux.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "lyt-pack-smoke-"));
const prefix = join(root, "prefix");
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run this check with npm run smoke:pack");
const run = (args) => execFileSync(process.execPath, args, {
  encoding: "utf8",
  env: { ...process.env, LYT_NO_UPDATE_CHECK: "1" },
});
const metadata = JSON.parse(run([npmCli, "pack", "--pack-destination", root, "--json"]));
run([npmCli, "install", "--global", "--prefix", prefix, "--ignore-scripts", join(root, metadata[0].filename)]);
const packageRoot = process.platform === "win32"
  ? join(prefix, "node_modules", "@tanattv", "lyt")
  : join(prefix, "lib", "node_modules", "@tanattv", "lyt");
const cli = join(packageRoot, "bin", "lyt.js");
assert.ok(existsSync(cli));
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version;
assert.equal(run([cli, "--version"]).trim(), `lyt ${version}`);
const capabilities = JSON.parse(run([cli, "capabilities", "--json"]));
assert.equal(capabilities.schema, "lyt.capabilities.v1");
assert.equal(capabilities.ok, true);
const planned = JSON.parse(run([cli, "--mp3", "--no-download", "--dry-run", "--json",
  "https://commons.wikimedia.org/wiki/File:Short_Silent,_Empty_Audio.ogg"]));
assert.equal(planned.ok, true);
assert.equal(planned.results[0].status, "planned");
run([cli, "agent", "install", "all", "--home", join(root, "agent-home")]);
const skill = readFileSync(join(packageRoot, "skills", "lyt", "SKILL.md"));
for (const agent of [".agents", ".claude"]) {
  assert.deepEqual(readFileSync(join(root, "agent-home", agent, "skills", "lyt", "SKILL.md")), skill);
}
console.log(`PACKED_INSTALL_OK ${process.platform} lyt ${version}`);
