#!/usr/bin/env node
// Sets the release version everywhere scripts/check-discovery.js expects it:
// package.json, both plugin manifests, the marketplace entry, the README
// result example, and a CHANGELOG heading.
//
//   node scripts/bump-version.js 0.8.3
//   node scripts/bump-version.js 0.8.3 --date 2026-10-20

import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const version = args.find((arg) => !arg.startsWith("--"));
const dateFlag = args.indexOf("--date");
const date = dateFlag >= 0 ? args[dateFlag + 1] : null;

if (!version || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
  console.error("Usage: node scripts/bump-version.js <x.y.z> [--date YYYY-MM-DD]");
  process.exit(2);
}

if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error("--date must look like YYYY-MM-DD");
  process.exit(2);
}

const root = new URL("../", import.meta.url);
const current = JSON.parse(readFileSync(new URL("package.json", root), "utf8")).version;

function update(path, change) {
  const url = new URL(path, root);
  const before = readFileSync(url, "utf8");
  const after = change(before);
  if (after === before) {
    console.log(`  unchanged  ${path}`);
    return;
  }
  writeFileSync(url, after);
  console.log(`  updated    ${path}`);
}

// Only the first "version" key in manifests is the package version.
const manifestVersion = (text) => text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);

console.log(`lyt ${current} -> ${version}`);
update("package.json", manifestVersion);
update("plugins/lyt/.claude-plugin/plugin.json", manifestVersion);
update("plugins/lyt/.codex-plugin/plugin.json", manifestVersion);
update(".claude-plugin/marketplace.json", (text) =>
  text.replace(/("name":\s*"lyt"[\s\S]*?"version":\s*")[^"]+(")/, `$1${version}$2`));
update("README.md", (text) =>
  text.replaceAll(`"version": "${current}"`, `"version": "${version}"`));
update("CHANGELOG.md", (text) => {
  const heading = `## [${version}]`;
  const stamp = date ?? "Unreleased";
  if (text.includes(heading)) {
    return date ? text.replace(new RegExp(`## \\[${version.replaceAll(".", "\\.")}\\][^\\r\\n]*`), `${heading} - ${date}`) : text;
  }
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return text.replace(/## \[Unreleased\][^\r\n]*/, (match) => `${match}${eol}${eol}${heading} - ${stamp}`);
});

console.log("Run `npm run check` to verify the release metadata.");
