# Releasing lyt

Use this checklist for every CLI release. Do not hardcode a release number in
this document; the package version is the source of truth.

## 1. Choose the version

- Patch: compatible fixes, hardening, documentation, and packaging corrections.
- Minor: additive commands, formats, discovery, or integration capabilities.
- Major: intentionally incompatible CLI or result-contract changes.

Update together:

- `package.json`
- `CHANGELOG.md`
- Codex and Claude plugin manifests
- marketplace catalog versions

The website reads the current version from the root package automatically.

## 2. Run automated gates

```sh
npm run check
npm run smoke:linux
node bin/lyt.js --version
npm pack --dry-run --json
```

`npm run check` must validate:

- the complete Node test suite;
- the exact npm publish payload;
- every generated website page and internal link;
- synchronized agent skill copies and plugin versions.

## 3. Perform clean-install smoke tests

Test at least one clean environment for each supported operating system:

```sh
npm install --global ./tanattv-lyt-<version>.tgz
lyt --version
lyt doctor
lyt doctor --json
lyt --video -q 1080p --dry-run "URL"
```

Also verify:

- one permitted native-audio download;
- one permitted ffmpeg-dependent operation;
- exact final paths in human and JSON output;
- variant-aware history behavior;
- direct Codex and Claude skill installation;
- the marketplace commands on documented compatible versions.

Never use private URLs, cookies, tokens, or copyrighted test media without
permission. Keep the reusable permitted smoke asset small.

For a packed live smoke on Windows (requires already provisioned yt-dlp and
ffmpeg), isolate install/history state and exercise native audio, MP3 conversion,
and the one-byte size guard:

```powershell
$env:LYT_SMOKE_LIVE = "1"
$env:LYT_SMOKE_TOOLS_PATH = Join-Path $env:LOCALAPPDATA "lyt/bin"
npm run smoke:pack
```

The optional live smoke uses the same small permitted Wikimedia Commons asset
as Linux CI and never provisions missing tools. Run the normal packed smoke
without `LYT_SMOKE_LIVE` for offline installation and skill checks.

Also check release discovery without installing any update:

```sh
lyt doctor --check-updates --json
```

Before publication this must report npm's currently published version, not the
candidate's version merely because it exists on GitHub. After publication, verify
the new npm version from an older installed CLI and check that the notice contains
the correct upgrade command. Offline cached status must be labeled as cached.

## 4. Verify public surfaces

- README commands match the packaged CLI.
- Product website builds with the production `SITE_URL`.
- GitHub Pages deploys and the public site reports the current version.
- `robots.txt`, `sitemap.xml`, `llms.txt`, `security.txt`, and the 404 route load.
- npm metadata, repository description, topics, and changelog match the release.

## 5. Publish

1. Merge the reviewed release PR.
2. Create GitHub Release `v<package version>` from the changelog entry.
3. Confirm the trusted-publishing workflow succeeds.
4. Verify `npm view @tanattv/lyt version` returns the new version.
5. Run one final clean global install from npm.

Do not publish when CI, Pages, package validation, or clean-install verification
is incomplete.

## Discovery checks and directory follow-up

`npm run check:discovery` checks release metadata, the README result version,
canonical skill copies, packaged AI facts, and directory listing assets.
Run the natural-language selection cases in `evals/skill-selection.json` in
fresh supported agent sessions. Record actual outcomes separately from static
validation. See [discovery-release.md](discovery-release.md) for submission
routes and account requirements. Directory acceptance and crawler indexing
are external outcomes; do not claim either from a successful build.
