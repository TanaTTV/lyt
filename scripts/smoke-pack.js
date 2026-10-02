// Verify a clean npm package installation on Windows, macOS, and Linux.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "lyt-pack-smoke-"));
const prefix = join(root, "prefix");
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run this check with npm run smoke:pack");
const env = { ...process.env, LYT_NO_UPDATE_CHECK: "1" };
// Keep optional live-test history/config out of the user's installation.
if (process.platform === "win32") env.LOCALAPPDATA = join(root, "data");
else if (process.platform === "darwin") env.HOME = join(root, "home");
else env.XDG_DATA_HOME = join(root, "data");
if (process.env.LYT_SMOKE_TOOLS_PATH) {
  env.PATH = `${process.env.LYT_SMOKE_TOOLS_PATH}${delimiter}${process.env.PATH ?? ""}`;
}
const run = (args) => execFileSync(process.execPath, args, {
  encoding: "utf8",
  env,
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
if (process.env.LYT_SMOKE_LIVE === "1") {
  const url = "https://commons.wikimedia.org/wiki/File:Short_Silent,_Empty_Audio.ogg";
  const download = (mode, directory) => JSON.parse(run([
    cli, ...mode, "--no-download", "--json", "--max-filesize", "1M", "-o", directory, url,
  ]));
  const nativeDir = join(root, "native");
  const native = download(["--audio", "--native"], nativeDir);
  const converted = download(["--mp3", "-q", "128K"], join(root, "converted"));
  for (const [result, extension] of [[native, ".ogg"], [converted, ".mp3"]]) {
    assert.equal(result.ok, true);
    assert.equal(result.results[0].status, "downloaded");
    assert.ok(result.results[0].files.length > 0);
    for (const file of result.results[0].files) {
      assert.ok(file.endsWith(extension));
      assert.ok(statSync(file).size > 0);
    }
  }
  // History dedupe currently identifies YouTube IDs only, so Commons is used
  // for real downloads while the unit integration covers history-only requests.
  try {
    run([cli, "--audio", "--native", "--no-history", "--no-download", "--json",
      "--max-filesize", "1", "-o", join(root, "size-guard"), url]);
    assert.fail("Expected the one-byte size guard to fail the download");
  } catch (error) {
    assert.equal(error.status, 1);
    const result = JSON.parse(error.stdout);
    assert.equal(result.results[0].reason, "max-filesize");
    assert.equal(result.results[0].status, "skipped");
  }
  console.log(`PACKED_LIVE_OK ${process.platform} native audio, MP3, size guard`);
}
console.log(`PACKED_INSTALL_OK ${process.platform} lyt ${version}`);
