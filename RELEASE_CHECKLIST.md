# lyt 0.7.0 release checklist

Version recommendation: **0.7.0**. This is a minor release because it adds an
agent-facing output contract and installer without removing existing commands
or changing default human-readable behavior. npm currently publishes `0.5.0`;
the repository's `0.6.0` feature work was never published, so `0.7.0` includes
both that accumulated CLI work and this agent-ready release pass.

## Automated gates

- [x] `npm run check` passes in the release worktree.
- [x] `node bin/lyt.js --version` prints `lyt 0.7.0`.
- [x] `node bin/lyt.js --dry-run --json --video -q 1080p "URL"` emits one valid
  `lyt.result.v1` JSON document without network or tool installation.
- [x] `npm pack --dry-run --json` includes `skills/`, `schemas/`, README,
  changelog, CLI entrypoints, install helpers, and runtime source.
- [x] The package excludes tests, reports, desktop app sources, and repository
  agent configuration.
- [ ] CI passes on Node 20 and 22 across Windows, macOS, and Linux.

## Manual smoke tests

- [x] Windows: fresh tarball install, MP3, 1080p video, and doctor.
- [x] Windows: verify `--json` returns existing final post-processed absolute paths.
- [ ] macOS: fresh npm install and one ffmpeg-backed download.
- [x] Linux: fresh tarball install and one ffmpeg-backed MP3 download in an ephemeral Debian container.
- [x] Linux: `npm run smoke:linux` passes a packed native-audio download in WSL2.
- [ ] Verify history skip and `--redownload` behavior in human and JSON modes.
- [x] Verify `--max-filesize` rejects an oversized media item safely without a file.
- [x] Verify `lyt agent install codex`, `claude`, and `all` from the packed tarball.
- [ ] Start a fresh Codex task and Claude Code task and confirm each discovers
  the installed lyt skill.

## Release preparation

- [x] Review README commands against `lyt --help`.
- [x] Confirm `CHANGELOG.md` contains every user-visible change.
- [ ] Confirm the GitHub release tag will be exactly `v0.7.0`.
- [ ] Confirm `NPM_TOKEN` and GitHub trusted publishing/provenance settings.
- [ ] Create release notes from the `0.7.0` changelog entry.
- [ ] Publish only after explicit owner approval.
