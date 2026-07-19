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
