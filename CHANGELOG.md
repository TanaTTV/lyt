# Changelog

All notable changes to lyt are documented here. This project follows semantic
versioning for the public CLI and machine-readable result contract.

## [Unreleased]

### Added

- Read-only `lyt inspect`, `lyt plan`, and bounded `lyt search` commands with
  versioned JSON schemas and no implicit download or tool-install side effects.
- Publisher-provided subtitle downloads with `--subs` and separately explicit
  generated captions with `--auto-subs`; exact sidecar paths are returned with
  the final artifact paths.
- Local artifact receipts backed by optional ffprobe metadata and SHA-256,
  plus `lyt verify` with an explicit local-integrity-only assurance boundary.
- `lyt.job-event.v1` JSONL download events, caller-provided job IDs, artifact
  events, and optional per-artifact receipts.
- The experimental Tauri shell now delegates search, inspect, and downloads to
  the canonical lyt sidecar and supports cancellation and retry in the UI.

### Changed

- Managed Windows ffmpeg setup now installs and verifies `ffprobe.exe` from the
  same checksum-verified archive.
- `lyt doctor` reports artifact receipt, hashing, ffprobe inspection, and media
  metadata capabilities separately.
- Prepared package and plugin metadata for the v0.8.0 review release.

## [0.7.2] - 2026-07-19

### Fixed

- Download history now distinguishes native audio, MP3, video quality, clips,
  chapter splitting, normalization, output directories, and templates instead
  of blocking every later request for the same YouTube ID.
- Repeated direct URLs in one invocation are deduplicated before tasks start.
- `lyt history <query> --limit <n>` no longer includes the limit value in the
  search query, and invalid history options now fail clearly.
- `--json --print-command` no longer writes human command text before the JSON
  document.
- Corrupt config files are moved aside with a timestamped backup instead of
  being silently ignored.
- Windows terminal and JSON paths on the product website now preserve the
  correct backslashes.
- Public setup copy no longer implies that ffmpeg is automatically provisioned
  on every operating system.
- Mobile visitors retain access to every website navigation link.
- The generated 404 page now uses project-safe absolute asset and home links.
- Helper installers now reject Node.js versions older than 20.
- Windows Explorer actions use lyt's validated `--paste` extraction instead of
  passing arbitrary clipboard text as a raw argument.

### Security

- Managed tool downloads now use bounded fetches, network timeouts, atomic file
  replacement, concurrent-install locks, and final executable probes.
- The Windows ffmpeg archive must match a published SHA-256 release digest or
  checksum asset before extraction.
- Managed yt-dlp checksum verification remains required.
- Windows Explorer actions now pass selected folders as native arguments to a
  fixed helper script instead of embedding folder names in PowerShell source.
- External helpers are resolved only from absolute PATH entries, preventing the
  working directory or relative PATH entries from shadowing trusted tools.
- Human command previews are inert, while JSON dry runs expose the executable
  and argument vector as structured fields.
- Unix config and history state is created with private directory and file
  permissions without changing permissions on caller-supplied parent folders.

### Changed

- Added a stable packaged entry layer that preprocesses user-facing CLI calls
  without breaking the existing `lyt`, `yt3`, `yt4`, or flag interfaces.
- `lyt doctor` now separates required core readiness from optional ffmpeg and
  clipboard capabilities and supports `--json` through `lyt.doctor.v1`.
- History listing supports `--json` through `lyt.history.v1`.
- npm installation no longer runs a postinstall lifecycle script.
- Root `npm run check` now validates tests, package contents, and every generated
  website page across the CI matrix.
- CI now covers Node.js 20, 22, and 24 on Windows, macOS, and Linux.
- Agent guidance now requires explicit approval before global installation,
  managed tool downloads, playlists, overwrites, authentication, or external
  downloaders.
- Website version, sitemap dates, and security.txt expiry are generated from
  the current package and build instead of hardcoded release values.
- Repository layout, release instructions, and the v0.8 product roadmap are now
  documented under `docs/` and `ROADMAP.md`.

### Compatibility

- Existing `lyt`, `yt3`, and `yt4` commands remain supported.
- `yt3` continues to mean fast native audio; MP3 remains explicit with `--mp3`.
- Existing flags and config keys remain compatible.
- `lyt.result.v1` remains backward-compatible.
- Legacy history remains readable and searchable. New variant-aware invocations
  may download a legacy source once to establish an exact artifact fingerprint.

## [0.7.1] - 2026-07-19

### Added

- A search-ready public product website with install, agent, Windows,
  comparison, privacy, sitemap, and structured-data pages.
- GitHub Pages deployment for the website.
- Contribution, security, conduct, and structured issue-reporting guidance.

### Changed

- Adopted the red feather-bolt identity across the README and application icon
  family.
- Pointed npm and GitHub visitors to the product website and expanded agent
  discovery keywords.

### Compatibility

- CLI commands, flags, JSON output, config, history, and agent installation
  behavior are unchanged from `0.7.0`.

## [0.7.0] - 2026-07-19

### Added

- Clipboard paste and watch modes, clips, chapter splitting, loudness
  normalization, download history and dedupe, profiles, persistent config,
  interactive format picking, `lyt doctor`, and managed tool bootstrap.
- `--json` with the stable `lyt.result.v1` result contract.
- Absolute final file paths captured from yt-dlp after post-processing.
- A packaged JSON Schema at `schemas/lyt.result.v1.schema.json`.
- `lyt agent install codex|claude|all` for one-command skill installation.
- A canonical packaged agent skill with permission-first guidance.
- `--max-filesize <size>` as an explicit download-size guard.
- Package-content validation through `npm run check:pack`.
- A complete `npm run check` release gate.

### Changed

- Version output reads directly from `package.json`, preventing drift.
- `--dry-run` installs or probes no tools.
- Successful human-readable downloads print their exact final saved paths.
- History entries retain final file paths and become fresh when recorded files
  have been deleted.
- CI tests runtime behavior and the npm publish payload on Windows, macOS, and
  Linux.
- npm publishing verifies the release tag and uses provenance attestations.

### Compatibility

- Existing `lyt`, `yt3`, and `yt4` commands remain supported.
- Existing flags and config files remain compatible.
- JSON output is additive; human-readable output remains the default.

[0.7.0]: https://github.com/TanaTTV/lyt/releases/tag/v0.7.0
[0.7.1]: https://github.com/TanaTTV/lyt/releases/tag/v0.7.1
[0.7.2]: https://github.com/TanaTTV/lyt/releases/tag/v0.7.2
