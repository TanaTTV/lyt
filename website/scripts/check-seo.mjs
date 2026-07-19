import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pages } from "../src/site.mjs";

const dist = resolve("dist");
const siteUrl = (process.env.SITE_URL || "https://tanattv.github.io/lyt").replace(/\/$/, "");
const titles = new Set();
const descriptions = new Set();

const requiredFiles = [
  "index.html",
  ...pages.filter((page) => page.slug).map((page) => `${page.slug}/index.html`),
  "404.html",
  "styles.css",
  "client.js",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "llms-full.txt",
  ".well-known/security.txt",
];

for (const file of requiredFiles) {
  const value = await readFile(join(dist, file), "utf8");
  assert.ok(value.trim().length > 0, `${file} must not be empty`);
}

for (const page of pages) {
  const file = page.slug ? `${page.slug}/index.html` : "index.html";
  const html = await readFile(join(dist, file), "utf8");
  const expectedCanonical = `${siteUrl}/${page.slug ? `${page.slug}/` : ""}`;
  const title = matchOne(html, /<title>([^<]+)<\/title>/, `${file} title`);
  const description = matchOne(
    html,
    /<meta name="description" content="([^"]+)">/,
    `${file} description`,
  );

  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${file} must contain one h1`);
  assert.ok(html.includes(`<link rel="canonical" href="${expectedCanonical}">`), `${file} canonical URL`);
  assert.ok(html.includes('<meta name="robots" content="index,follow'), `${file} must be indexable`);
  assert.ok(html.includes('<a class="skip" href="#main">'), `${file} must have a skip link`);
  assert.ok(html.includes('aria-label="Primary navigation"'), `${file} must label navigation`);
  assert.ok(!titles.has(title), `duplicate title: ${title}`);
  assert.ok(!descriptions.has(description), `duplicate description: ${description}`);
  titles.add(title);
  descriptions.add(description);

  await validateInternalLinks(html, file);
}

const home = await readFile(join(dist, "index.html"), "utf8");
assert.match(home, /<script type="application\/ld\+json">/);
assert.match(home, /"SoftwareApplication"/);
assert.match(home, /"softwareVersion":"\d+\.\d+\.\d+"/);
assert.ok(home.includes("C:\\Users\\you\\Downloads\\Example.mp4"), "terminal Windows path must keep backslashes");
assert.ok(!home.includes("C:UsersyouDownloads"), "terminal Windows path must not collapse");
assert.ok(home.includes('"files": ["C:\\\\Downloads\\\\Example.mp3"]'), "displayed JSON example must escape Windows paths");
assert.ok(!home.includes("Automatic yt-dlp and ffmpeg setup"), "site must not overclaim cross-platform ffmpeg provisioning");

const css = await readFile(join(dist, "styles.css"), "utf8");
assert.ok(!css.includes(".nav-links a:not(.nav-cta) { display: none; }"), "mobile navigation must remain reachable");
assert.match(css, /@media \(max-width: 820px\)/);

const notFound = await readFile(join(dist, "404.html"), "utf8");
assert.ok(notFound.includes(`${siteUrl}/styles.css`), "404 stylesheet must use an absolute project URL");
assert.ok(notFound.includes(`${siteUrl}/`), "404 home link must use an absolute project URL");
assert.match(notFound, /<meta name="robots" content="noindex">/);

const robots = await readFile(join(dist, "robots.txt"), "utf8");
for (const agent of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Googlebot", "Bingbot"]) {
  assert.match(robots, new RegExp(`User-agent: ${agent}\\nAllow: /`));
}
assert.ok(robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`));

const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
for (const page of pages) {
  assert.ok(sitemap.includes(`<loc>${siteUrl}/${page.slug ? `${page.slug}/` : ""}</loc>`));
}
assert.ok(sitemap.includes("<lastmod>"));

const llms = await readFile(join(dist, "llms.txt"), "utf8");
assert.ok(llms.includes("@tanattv/lyt"));
assert.ok(llms.includes(`${siteUrl}/ai/`));
assert.match(llms, /Version: \d+\.\d+\.\d+/);

const security = await readFile(join(dist, ".well-known", "security.txt"), "utf8");
assert.match(security, /Expires: \d{4}-\d{2}-\d{2}T/);

console.log(`Website checks passed for ${pages.length} pages and ${requiredFiles.length} required files.`);

function matchOne(value, pattern, label) {
  const matches = [...value.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
  assert.equal(matches.length, 1, `${label} must occur exactly once`);
  return matches[0][1];
}

async function validateInternalLinks(html, fromFile) {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const fromDir = fromFile === "index.html" ? "" : fromFile.replace(/\/index\.html$/, "");

  for (const href of hrefs) {
    if (/^(?:https?:|mailto:|#)/.test(href)) continue;
    const clean = href.split(/[?#]/)[0];
    if (!clean) continue;

    const relative = clean.endsWith("/") ? `${clean}index.html` : clean;
    const target = resolve(dist, fromDir, relative);
    assert.ok(target.startsWith(dist), `unsafe internal link in ${fromFile}: ${href}`);
    await access(target).catch(() => {
      assert.fail(`broken internal link in ${fromFile}: ${href}`);
    });
  }
}
