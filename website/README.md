# lyt product site

A dependency-free static site built with Node 20. It produces search-friendly
HTML, canonical URLs, Open Graph metadata, JSON-LD, `robots.txt`, and a sitemap.

## Build

```powershell
npm run build
```

The default canonical URL is `https://tanattv.github.io/lyt`. Set the final URL
before publishing somewhere else:

```powershell
$env:SITE_URL = "https://example.com"
npm run build
```

## Check

```powershell
npm run check
```

Builds the site, then `scripts/check-seo.mjs` enforces unique titles and
descriptions within length bounds, one `h1` and no skipped heading levels,
valid JSON-LD, canonical and social tags, image `alt`/`width`/`height`, no
broken internal links or `#fragments`, sitemap and `llms.txt` coverage, size
budgets, and that every `lyt` command shown uses a flag the CLI ships. See
`SEO_AUDIT.md` for the latest audit.

## Adding commands

Download flags in `src/capabilities.js` appear automatically in the "All
options" table on `/commands/` and in `/capabilities.json`. Add a copyable
recipe to the matching group in `src/pages/commands.mjs`, and to
`renderLlms()` in `scripts/build.mjs` if agents should map a request to it.

## Preview

```powershell
npm run serve
```

Open <http://localhost:4173>.

## Publish checklist

- choose and verify the final HTTPS URL;
- rebuild with `SITE_URL` set to that URL;
- inspect every canonical and social-preview URL;
- publish `dist/`;
- connect the URL to GitHub and npm metadata;
- submit `sitemap.xml` through Google Search Console.
