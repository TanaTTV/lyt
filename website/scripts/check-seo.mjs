import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const dist = resolve("dist");
const siteUrl = (process.env.SITE_URL || "https://tanattv.github.io/lyt").replace(/\/$/, "");

const requiredFiles = [
  "index.html",
  "ai/index.html",
  "agents/index.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "llms-full.txt",
  ".well-known/security.txt"
];

for (const file of requiredFiles) {
  const value = await readFile(join(dist, file), "utf8");
  assert.ok(value.trim().length > 0, `${file} must not be empty`);
}

const home = await readFile(join(dist, "index.html"), "utf8");
assert.match(home, /<link rel="canonical" href="https:\/\//);
assert.match(home, /<meta name="description" content="[^"]+">/);
assert.match(home, /<meta name="robots" content="index,follow/);
assert.match(home, /<script type="application\/ld\+json">/);
assert.match(home, /"SoftwareApplication"/);
assert.doesNotMatch(home, /noindex/i);

const robots = await readFile(join(dist, "robots.txt"), "utf8");
for (const agent of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Googlebot", "Bingbot"]) {
  assert.match(robots, new RegExp(`User-agent: ${agent}\\nAllow: /`));
}
assert.ok(robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`));

const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
assert.ok(sitemap.includes(`<loc>${siteUrl}/ai/</loc>`));
assert.ok(sitemap.includes("<lastmod>"));

const llms = await readFile(join(dist, "llms.txt"), "utf8");
assert.ok(llms.includes("@tanattv/lyt"));
assert.ok(llms.includes(`${siteUrl}/ai/`));

console.log(`SEO checks passed for ${requiredFiles.length} required files.`);
