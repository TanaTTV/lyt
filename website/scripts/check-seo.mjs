// Post-build checks for SEO, accessibility basics, agent-facing files, and
// command accuracy. Run with `npm run check` (builds first). Every assertion
// here guards a regression that has happened or is easy to reintroduce.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pages } from "../src/site.mjs";
import { OPTIONS } from "../../src/capabilities.js";

const siteRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(siteRoot, "..");
const dist = join(siteRoot, "dist");
const siteUrl = (process.env.SITE_URL || "https://tanattv.github.io/lyt").replace(/\/$/, "");
const packageVersion = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")).version;
const titles = new Set();
const descriptions = new Set();
const htmlByFile = new Map();

// Size budgets keep the site fast on mobile. Raise them deliberately, not by accident.
const budgets = { html: 100_000, css: 70_000, js: 20_000, font: 60_000 };

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
  "capabilities.json",
  ".well-known/security.txt",
];

for (const file of requiredFiles) {
  const value = await readFile(join(dist, file), "utf8");
  assert.ok(value.trim().length > 0, `${file} must not be empty`);
}

const allowedFlags = await cliFlags();

for (const page of pages) {
  const file = pageFile(page);
  const html = await readFile(join(dist, file), "utf8");
  htmlByFile.set(file, html);
  const expectedCanonical = `${siteUrl}/${page.slug ? `${page.slug}/` : ""}`;
  const title = decode(matchOne(html, /<title>([^<]+)<\/title>/, `${file} title`));
  const description = decode(matchOne(
    html,
    /<meta name="description" content="([^"]+)">/,
    `${file} description`,
  ));

  // Basics: language, charset, viewport, canonical, indexability.
  assert.ok(html.startsWith("<!doctype html>"), `${file} must start with a doctype`);
  assert.ok(html.includes('<html lang="en">'), `${file} must declare lang="en"`);
  assert.ok(html.includes('<meta charset="utf-8">'), `${file} must declare utf-8`);
  assert.ok(html.includes('<meta name="viewport" content="width=device-width,initial-scale=1">'), `${file} viewport`);
  assert.ok(html.includes(`<link rel="canonical" href="${expectedCanonical}">`), `${file} canonical URL`);
  assert.ok(html.includes('<meta name="robots" content="index,follow'), `${file} must be indexable`);

  // Titles and descriptions: unique and within the lengths search results show.
  assert.ok(!titles.has(title), `duplicate title: ${title}`);
  assert.ok(!descriptions.has(description), `duplicate description: ${description}`);
  titles.add(title);
  descriptions.add(description);
  assert.ok(title.length >= 25 && title.length <= 65, `${file} title must be 25-65 characters (${title.length})`);
  assert.ok(
    description.length >= 110 && description.length <= 170,
    `${file} description must be 110-170 characters (${description.length})`,
  );

  // Social cards mirror the page.
  assert.equal(decode(metaContent(html, "property", "og:title")), title, `${file} og:title must match the title`);
  assert.equal(decode(metaContent(html, "property", "og:description")), description, `${file} og:description`);
  assert.equal(metaContent(html, "property", "og:url"), expectedCanonical, `${file} og:url must match canonical`);
  assert.match(metaContent(html, "property", "og:image"), /social-card\.png$/, `${file} og:image must point at social-card.png`);
  assert.ok(metaContent(html, "property", "og:image:alt"), `${file} og:image:alt`);
  assert.equal(metaContent(html, "name", "twitter:card"), "summary_large_image", `${file} twitter:card`);
  assert.equal(decode(metaContent(html, "name", "twitter:title")), title, `${file} twitter:title`);
  assert.ok(metaContent(html, "name", "twitter:image:alt"), `${file} twitter:image:alt`);
  assert.ok(html.includes('rel="apple-touch-icon"'), `${file} must declare an apple-touch-icon`);
  assert.match(html, /<link rel="preload" href="[^"]*fonts\/inter-latin\.woff2" as="font" type="font\/woff2" crossorigin>/, `${file} must preload the font`);

  // Headings: exactly one h1, it comes first, and levels never skip.
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${file} must contain one h1`);
  const levels = [...html.matchAll(/<h([1-6])(?:\s|>)/g)].map((match) => Number(match[1]));
  assert.equal(levels[0], 1, `${file} first heading must be h1`);
  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(levels[index] <= levels[index - 1] + 1, `${file} heading order skips from h${levels[index - 1]} to h${levels[index]}`);
  }

  // Accessibility basics.
  assert.ok(html.includes('<a class="skip" href="#main">'), `${file} must have a skip link`);
  assert.ok(html.includes('<main id="main"'), `${file} skip link target`);
  assert.ok(html.includes('aria-label="Primary navigation"'), `${file} must label navigation`);
  assert.ok(html.includes('class="nav-toggle"'), `${file} must have a mobile nav toggle`);
  assert.ok(html.includes('id="nav-links"'), `${file} must have a nav-links container`);
  assert.ok(html.includes('id="live-status"'), `${file} must have the polite live region`);
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    assert.match(img, /\salt="[^"]*"/, `${file} image without alt: ${img}`);
    assert.match(img, /\swidth="\d+"/, `${file} image without width: ${img}`);
    assert.match(img, /\sheight="\d+"/, `${file} image without height: ${img}`);
  }
  for (const [button, inner] of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    const named = /aria-label="[^"]+"/.test(button) || inner.replace(/<[^>]+>/g, "").trim().length > 0;
    assert.ok(named, `${file} button without an accessible name: ${button.slice(0, 80)}`);
  }
  for (const [, id] of html.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)) {
    assert.ok(html.includes(`for="${id}"`), `${file} input #${id} needs a label`);
  }
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicateIds, [], `${file} has duplicate ids`);
  assert.ok(!/href="http:\/\//.test(html), `${file} must not link over plain http`);

  // Footer rights note on every page.
  assert.ok(html.includes("lyt does not bypass DRM, paywalls, or access controls."), `${file} footer rights note`);

  // Structured data: valid JSON, schema.org, typed nodes, FAQ matches the visible FAQ.
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(ldBlocks.length, 1, `${file} must contain one ld+json block`);
  let ld;
  try {
    ld = JSON.parse(ldBlocks[0][1]);
  } catch (error) {
    assert.fail(`${file} ld+json is not valid JSON: ${error.message}`);
  }
  assert.equal(ld["@context"], "https://schema.org", `${file} ld+json @context`);
  assert.ok(Array.isArray(ld["@graph"]) && ld["@graph"].every((node) => node["@type"]), `${file} ld+json nodes need @type`);
  const types = ld["@graph"].map((node) => node["@type"]);
  assert.ok(types.includes("WebPage"), `${file} ld+json must include WebPage`);
  if (page.slug) assert.ok(types.includes("BreadcrumbList"), `${file} must include BreadcrumbList`);
  if (page.faq?.length) {
    const faqNode = ld["@graph"].find((node) => node["@type"] === "FAQPage");
    assert.ok(faqNode, `${file} must include FAQPage structured data`);
    const visible = [...html.matchAll(/<details><summary>([^<]+)<\/summary>/g)].map((match) => decode(match[1]));
    for (const question of faqNode.mainEntity) {
      assert.ok(visible.includes(question.name), `${file} FAQ JSON-LD question is not visible on the page: ${question.name}`);
    }
  }

  // Page weight.
  assert.ok(Buffer.byteLength(html) <= budgets.html, `${file} is over the ${budgets.html} byte HTML budget`);

  // Every lyt command shown on the page uses flags the CLI actually ships.
  for (const command of lytCommands(html)) {
    for (const token of command.split(/\s+/)) {
      const flag = token.replace(/=.*$/, "");
      if (/^--[a-z][a-z0-9-]*$/.test(flag) || /^-[A-Za-z]$/.test(flag)) {
        assert.ok(allowedFlags.has(flag), `${file} shows "${command}" with ${flag}, which the CLI does not ship`);
      }
    }
  }
}

// Links and fragments, after every page is loaded so cross-page anchors resolve.
for (const [file, html] of htmlByFile) await validateInternalLinks(html, file);

// Navigation lists every page that declares a nav label.
const homeHtml = htmlByFile.get("index.html");
for (const page of pages.filter((item) => item.nav)) {
  assert.ok(homeHtml.includes(`<a href="${page.slug}/">${page.nav}</a>`), `primary nav must link ${page.slug}`);
}

const home = homeHtml;
assert.match(home, /"SoftwareApplication"/);
assert.ok(home.includes('"FAQPage"'), "home must include FAQPage structured data");
// Semver, including prereleases such as 0.8.2-rc.1.
assert.match(home, /"softwareVersion":"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?"/);
assert.ok(home.includes(`<b>v${packageVersion}</b>`), "release pill must show the package version");
assert.ok(home.includes("C:\\Users\\you\\Downloads\\Example.mp4"), "terminal Windows path must keep backslashes");
assert.ok(!home.includes("C:UsersyouDownloads"), "terminal Windows path must not collapse");
assert.ok(home.includes('"files": ["C:\\\\Downloads\\\\Example.mp3"]'), "displayed JSON example must escape Windows paths");
assert.ok(!home.includes("Automatic yt-dlp and ffmpeg setup"), "site must not overclaim cross-platform ffmpeg provisioning");
assert.ok(home.includes('href="start/"'), "home must link the beginner guide");

// Beginner and troubleshooting coverage that people search for.
const start = htmlByFile.get("start/index.html");
for (const id of ["windows", "mac", "first-file", "common-tasks", "song-mp3", "video-1080p", "clip-for-edit", "subtitles", "playlist"]) {
  assert.ok(start.includes(`id="${id}"`), `start page must keep #${id}`);
}
const helpPage = htmlByFile.get("help/index.html");
for (const id of ["bot-check", "format-unavailable", "http-403-429", "ai-assistant", "ffmpeg-missing", "not-recognized"]) {
  assert.ok(helpPage.includes(`id="${id}"`), `help page must keep #${id}`);
}
assert.ok(helpPage.includes("lyt doctor --update"), "help page must explain updating yt-dlp");
assert.ok(helpPage.includes("--cookies-from-browser"), "help page must scope browser cookies");
assert.ok(helpPage.includes("lyt -L"), "help page must show how to list formats");

const css = await readFile(join(dist, "styles.css"), "utf8");
assert.ok(!css.includes(".nav-links a:not(.nav-cta) { display: none; }"), "mobile navigation must remain reachable");
assert.match(css, /@media \(max-width: 820px\)/);
assert.match(css, /@media \(max-width: 960px\)/, "nav must collapse below 960px");
assert.match(css, /:focus-visible\s*\{[^}]*outline:/, "visible focus styles");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, "reduced-motion support");
assert.ok(Buffer.byteLength(css) <= budgets.css, `styles.css is over the ${budgets.css} byte budget`);
const js = await readFile(join(dist, "client.js"), "utf8");
assert.ok(Buffer.byteLength(js) <= budgets.js, `client.js is over the ${budgets.js} byte budget`);
assert.ok((await stat(join(dist, "fonts", "inter-latin.woff2"))).size <= budgets.font, "font is over budget");
assert.ok(js.includes("min-width: 961px"), "client.js menu reset must match the 960px nav breakpoint");

const notFound = await readFile(join(dist, "404.html"), "utf8");
assert.ok(notFound.includes(`${siteUrl}/styles.css`), "404 stylesheet must use an absolute project URL");
assert.ok(notFound.includes(`${siteUrl}/`), "404 home link must use an absolute project URL");
assert.match(notFound, /<meta name="robots" content="noindex">/);
assert.ok(!notFound.includes('rel="canonical"'), "404 must not declare a canonical URL");
assert.equal((notFound.match(/<h1(?:\s|>)/g) ?? []).length, 1, "404 must contain one h1");
for (const [, href] of notFound.matchAll(/href="([^"]+)"/g)) {
  assert.ok(href.startsWith(`${siteUrl}/`), `404 links must be absolute project URLs: ${href}`);
  const local = href.slice(siteUrl.length + 1).split(/[?#]/)[0];
  await access(join(dist, local.endsWith("/") || local === "" ? `${local}index.html` : local))
    .catch(() => assert.fail(`404 links to a missing file: ${href}`));
}

const robots = await readFile(join(dist, "robots.txt"), "utf8");
for (const agent of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Googlebot", "Bingbot"]) {
  assert.match(robots, new RegExp(`User-agent: ${agent}\\nAllow: /`));
}
assert.ok(robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`));

const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, pages.length, "sitemap must list each page exactly once");
for (const page of pages) {
  assert.ok(sitemapUrls.includes(`${siteUrl}/${page.slug ? `${page.slug}/` : ""}`), `sitemap must list ${page.slug || "home"}`);
}
assert.ok(sitemap.includes("<lastmod>"));

const llms = await readFile(join(dist, "llms.txt"), "utf8");
assert.ok(llms.includes("@tanattv/lyt"));
assert.ok(llms.includes(`${siteUrl}/ai/`));
assert.match(llms, new RegExp(`Version: ${packageVersion.replaceAll(".", "\\.")}`));
for (const page of pages.filter((item) => item.slug)) {
  assert.ok(llms.includes(`${siteUrl}/${page.slug}/`), `llms.txt must link ${page.slug}`);
}
for (const command of llms.split("\n").filter((line) => /: lyt /.test(line)).map((line) => line.split(": ").slice(1).join(": "))) {
  for (const token of command.split(/\s+/)) {
    if (/^--[a-z][a-z0-9-]*$/.test(token) || /^-[A-Za-z]$/.test(token)) {
      assert.ok(allowedFlags.has(token), `llms.txt shows ${token}, which the CLI does not ship`);
    }
  }
}
const llmsFull = await readFile(join(dist, "llms-full.txt"), "utf8");
for (const slug of ["codex-audio", "claude-video", "agent-clips"]) {
  assert.ok(llms.includes(`${siteUrl}/${slug}/`), `${slug}: concise AI reference`);
  assert.ok(llmsFull.includes(`${siteUrl}/${slug}/`), `${slug}: expanded AI reference`);
  const guide = htmlByFile.get(`${slug}/index.html`);
  assert.ok(guide.includes("lyt.result.v1"), `${slug}: result contract`);
  assert.ok(guide.includes("lyt info --no-download --json"), `${slug}: inspection command`);
}
for (const slug of ["start", "help"]) assert.ok(llmsFull.includes(`${siteUrl}/${slug}/`), `${slug}: expanded AI reference`);

const capabilities = JSON.parse(await readFile(join(dist, "capabilities.json"), "utf8"));
assert.equal(capabilities.schema, "lyt.capabilities.v1");
assert.equal(capabilities.version, packageVersion, "capabilities.json must match the package version");
assert.deepEqual(capabilities.options.map((option) => option.flag), OPTIONS.map((option) => option.flag));
const commandsPage = htmlByFile.get("commands/index.html");
for (const option of OPTIONS) {
  assert.ok(commandsPage.includes(`<code>${option.flag}</code>`), `commands page must list ${option.flag}`);
}

const security = await readFile(join(dist, ".well-known", "security.txt"), "utf8");
assert.match(security, /Expires: \d{4}-\d{2}-\d{2}T/);

console.log(`Website checks passed for ${pages.length} pages and ${requiredFiles.length} required files.`);

function pageFile(page) {
  return page.slug ? `${page.slug}/index.html` : "index.html";
}

function matchOne(value, pattern, label) {
  const matches = [...value.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
  assert.equal(matches.length, 1, `${label} must occur exactly once`);
  return matches[0][1];
}

function metaContent(html, attribute, name) {
  const match = html.match(new RegExp(`<meta ${attribute}="${name.replace(/[.:]/g, "\\$&")}" content="([^"]*)">`));
  return match ? match[1] : "";
}

function decode(value) {
  return String(value)
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#10;", "\n")
    .replaceAll("&amp;", "&");
}

// Commands people can copy: data-copy values and inline <code> that start with lyt.
function lytCommands(html) {
  const sources = [
    ...[...html.matchAll(/data-copy="([^"]*)"/g)].map((match) => decode(match[1])),
    ...[...html.matchAll(/<code>([^<]*)<\/code>/g)].map((match) => decode(match[1])),
  ];
  return sources
    .flatMap((text) => text.split("\n"))
    .map((line) => line.trim())
    .filter((line) => /^(?:lyt|yt3|yt4)(?:\s|$)/.test(line));
}

// The flags the CLI accepts: its help text, its capabilities list, and the
// subcommand parsers.
async function cliFlags() {
  const help = spawnSync(process.execPath, [join(repoRoot, "bin", "lyt.js"), "--help"], {
    encoding: "utf8",
    env: { ...process.env, LYT_NO_UPDATE_CHECK: "1" },
  });
  assert.equal(help.status, 0, `lyt --help failed: ${help.stderr}`);
  const subcommandSource = await readFile(join(repoRoot, "src", "commandArgs.js"), "utf8");
  const flags = new Set(OPTIONS.map((option) => option.flag));
  for (const text of [help.stdout, subcommandSource]) {
    for (const [flag] of text.matchAll(/--[a-z][a-z0-9-]*/g)) flags.add(flag);
  }
  for (const [, flag] of help.stdout.matchAll(/(?:^|[\s,])(-[A-Za-z])(?=[\s,])/gm)) flags.add(flag);
  return flags;
}

async function validateInternalLinks(html, fromFile) {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => decode(match[1]));
  const fromDir = fromFile === "index.html" ? "" : fromFile.replace(/\/index\.html$/, "");

  for (const href of hrefs) {
    if (/^(?:https?:|mailto:)/.test(href)) continue;
    const [path, fragment] = href.split("#");
    const clean = path.split("?")[0];
    let targetFile = fromFile;

    if (clean) {
      const relative = clean.endsWith("/") ? `${clean}index.html` : clean;
      const target = resolve(dist, fromDir, relative);
      assert.ok(target.startsWith(dist), `unsafe internal link in ${fromFile}: ${href}`);
      await access(target).catch(() => {
        assert.fail(`broken internal link in ${fromFile}: ${href}`);
      });
      targetFile = target.slice(dist.length + 1).replaceAll("\\", "/");
    }

    if (fragment) {
      const targetHtml = htmlByFile.get(targetFile);
      if (!targetHtml) continue;
      assert.ok(targetHtml.includes(`id="${fragment}"`), `broken fragment in ${fromFile}: ${href}`);
    }
  }
}
