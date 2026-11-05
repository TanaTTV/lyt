# Website SEO and accessibility audit

Audit of the built site (`npm run build`, `dist/`) on 2026-11-05, lyt 0.8.2.
`npm run check` now enforces the items marked **enforced**.

| # | Issue | Page(s) | Fix | Status |
|---|---|---|---|---|
| 1 | Heading order skipped from h2 to h4: footer column titles were `<h4>` | all pages | Footer columns are now labelled `<nav>` blocks with a styled `<p>` title | Fixed, enforced |
| 2 | Small print failed WCAG AA contrast: `--faint` #5f5f6b on #07070a was about 3.1:1 (legal note, footer, terminal comments) | all pages | `--faint` raised to #80808c (about 5:1) | Fixed |
| 3 | White text on the bright brand red (#ff2a4a) was about 3.7:1 on primary buttons and the release pill | all pages | Added `--red-deep` #d91232 (5.1:1, hover 4.5:1) for white-on-red surfaces; the bright red stays the accent | Fixed |
| 4 | Copy buttons changed a visible label, but their fixed `aria-label` meant screen readers heard nothing | all pages | Polite `role="status"` live region announces "Copied" or a failure; command search announces result counts | Fixed, enforced |
| 5 | Release pill hardcoded `v0.8.2` and would drift after a release | home | Reads the version from package.json | Fixed, enforced |
| 6 | 404 had a canonical URL (noindex pages should not), no brand link, and only two exits | 404 | Canonical removed; brand link, Start here, Install, Commands, Help, Agents links added; all URLs absolute | Fixed, enforced |
| 7 | No `twitter:image:alt`; guide pages used `og:type` website | all pages | Added `twitter:image:alt`; guide pages use `og:type` article | Fixed, enforced |
| 8 | No beginner path for people new to the terminal | site | New `/start/` page: Windows and Mac steps in plain words, first file, common tasks | Fixed, enforced |
| 9 | No troubleshooting page for the most common download errors | site | New `/help/` page: bot check, unavailable format, 403/429, AI assistant refusals, ffmpeg, PATH, PowerShell, EACCES, certificates, skips, Spotify 100-song limit, Linux clipboard | Fixed, enforced |
| 10 | Command reference missed shipped flags and subcommand options (`--audio`, `--history`, `-f`, `--queue`, `info --no-download`, `doctor --json`, `doctor --check-updates`, `history --json --limit`, `config get`/`unset`) | /commands/ | Added; plus an "All options" table generated from `src/capabilities.js` at build time | Fixed, enforced |
| 11 | Agents had no published flag list without installing lyt | site | `/capabilities.json` is the exact `lyt.capabilities.v1` document for the published version | Fixed, enforced |
| 12 | `llms.txt` did not link Windows, Compare, or the new pages, and had no failure guidance | llms.txt, llms-full.txt | Links every page; adds exit codes and a short "Common failures" map | Fixed, enforced |
| 13 | Seven nav links would crowd the header between 821 and 960px | all pages | Menu collapses below 960px; mobile menu scrolls if taller than the screen | Fixed, enforced |
| 14 | Agents page had no guidance on skip reasons, exit codes, or when to ask before updating tools | /agents/ | New "How should an agent handle failures and skips?" section | Fixed |
| 15 | `.sr-only` lacked margin/border resets | all pages | Standard visually-hidden rules | Fixed |
| 16 | Link checker ignored `#fragment` targets | check script | Same-page and cross-page fragments must resolve to an id | Fixed, enforced |

## Checked and fine

- One `<h1>` per page; `lang="en"`, charset, viewport, canonical, and robots on every page.
- Titles 40-59 characters and descriptions 136-157 characters, all unique (bounds 25-65 and 110-170 enforced).
- JSON-LD parses on every page (WebSite, SoftwareApplication, WebPage, TechArticle, BreadcrumbList, FAQPage); FAQ structured data matches the visible FAQ (enforced).
- Every `<img>` has `alt`, `width`, and `height` (enforced). Decorative logos use `alt=""` next to visible text.
- Font is preloaded with `crossorigin` and `font-display: swap`; one stylesheet (about 45 KB) and one deferred script (about 9 KB). No third-party requests.
- Page weight: largest HTML page is /commands/ at about 73 KB; budgets enforced for HTML, CSS, JS, and the font.
- Skip link, visible `:focus-visible` outline, labelled search input, labelled nav, tab semantics on the terminal demo, `prefers-reduced-motion` support.
- sitemap.xml lists each page exactly once; robots.txt allows search and AI crawlers and points at the sitemap.
- Every `lyt` command shown on any page, and in llms.txt, uses only flags that `lyt --help`, `lyt capabilities --json`, or the subcommand parsers accept (enforced).

## Not fixed

- **No pre-rendered social image per page.** All pages share `social-card.png`. Per-page cards would need an image pipeline; the shared card is accurate for every page.
- **No browser-rendered visual or Lighthouse run in this audit.** No headless browser was available in the build environment. Layout at 390px was reviewed in the CSS (single-column grids under 640px, horizontal scroll inside code blocks and tables only). Run Lighthouse on the deployed URL after publishing.
- **The Inter subset omits U+2192 (→).** Arrows fall back to the system font. Cosmetic only.
- **`sitemap.xml` `lastmod` is the build date for every page**, not a per-page edit date. Accurate enough for a small site; per-page dates would need git history at build time.
