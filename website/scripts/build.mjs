import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pages } from "../src/site.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptsDir, "..");
const dist = resolve(siteRoot, "dist");
const configuredUrl = process.env.SITE_URL || "https://tanattv.github.io/lyt";
const siteUrl = configuredUrl.replace(/\/$/, "");

if (!dist.startsWith(siteRoot)) throw new Error("Refusing to build outside the site root");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(siteRoot, "public"), dist, { recursive: true });
await cp(join(siteRoot, "src", "styles.css"), join(dist, "styles.css"));
await cp(join(siteRoot, "src", "client.js"), join(dist, "client.js"));

for (const page of pages) {
  const outputDir = page.slug ? join(dist, page.slug) : dist;
  const prefix = page.slug ? "../" : "";
  const canonical = `${siteUrl}/${page.slug ? `${page.slug}/` : ""}`;
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "index.html"), renderPage(page, prefix, canonical));
}

await writeFile(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
await writeFile(join(dist, "sitemap.xml"), renderSitemap());
await writeFile(join(dist, "404.html"), render404());

console.log(`Built ${pages.length} pages in ${dist}`);
console.log(`Canonical site URL: ${siteUrl}`);

function renderPage(page, prefix, canonical) {
  const nav = pages.filter((item) => item.nav).map((item) => {
    const href = item.slug ? `${prefix}${item.slug}/` : prefix || "./";
    const current = item.slug === page.slug ? ' aria-current="page"' : "";
    return `<a href="${href}"${current}>${item.nav}</a>`;
  }).join("");

  const schema = page.slug === "" ? `
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "lyt",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Windows, macOS, Linux",
    isAccessibleForFree: true,
    softwareVersion: "0.7.1",
    license: "https://opensource.org/license/mit",
    downloadUrl: "https://www.npmjs.com/package/@tanattv/lyt",
    codeRepository: "https://github.com/TanaTTV/lyt",
    description: page.description
  }).replace(/</g, "\\u003c")}</script>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="theme-color" content="#ff1f3d">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="${prefix}lyt-logo.png">
  <link rel="stylesheet" href="${prefix}styles.css">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="lyt">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${siteUrl}/lyt-logo.png">
  <meta name="twitter:card" content="summary">
  ${schema}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <nav class="nav shell" aria-label="Primary navigation">
      <a class="brand" href="${prefix || "./"}"><img src="${prefix}lyt-logo.png" alt="" width="38" height="38"><span>lyt</span></a>
      <div class="nav-links">${nav}<a class="nav-cta" href="https://github.com/TanaTTV/lyt">GitHub ↗</a></div>
    </nav>
  </header>
  ${page.body}
  <footer class="site-footer"><div class="footer-inner shell"><span>lyt is free, open source, and local-first.</span><div class="footer-links"><a href="${prefix}privacy/">Privacy & use</a><a href="https://www.npmjs.com/package/@tanattv/lyt">npm</a><a href="https://github.com/TanaTTV/lyt">GitHub</a></div></div></footer>
  <script src="${prefix}client.js" defer></script>
</body>
</html>`;
}

function renderSitemap() {
  const urls = pages.map((page) => `  <url><loc>${siteUrl}/${page.slug ? `${page.slug}/` : ""}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function render404() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · lyt</title><meta name="description" content="The requested lyt page could not be found."><link rel="canonical" href="${siteUrl}/404.html"><link rel="stylesheet" href="styles.css"></head><body><main id="main" class="doc shell"><div class="kicker">404</div><h1>That path did not land.</h1><p class="lede">Return to lyt and start from a verified route.</p><a class="button primary" href="./">Go home</a></main></body></html>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
