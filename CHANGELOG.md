# Changelog

All notable changes to lyt are documented here. This project follows semantic
versioning for the public CLI and machine-readable result contract.

## [0.7.0] - 2026-07-19

### Added

- Previously unreleased 0.6 work now included for npm users: clipboard paste
  and watch modes, clips, chapter splitting, loudness normalization, download
  history and dedupe, profiles, persistent config, interactive format picking,
  `lyt doctor`, and managed tool bootstrap.
- `--json` with the stable `lyt.result.v1` result contract.
- Absolute final file paths captured from yt-dlp after post-processing.
- A packaged JSON Schema at `schemas/lyt.result.v1.schema.json`.
- `lyt agent install codex|claude|all` for one-command skill installation,
  with `--home <dir>` for managed environments and isolated verification.
- A canonical packaged agent skill with permission-first guidance and safe
  agent defaults.
- `--max-filesize <size>` as an explicit download-size guard.
- Explicit non-zero `max-filesize` and no-output results instead of silent
  successful runs with an empty file list.
- Package-content validation through `npm run check:pack`.
- A complete `npm run check` release gate.

### Changed

- Version output now reads directly from `package.json`, preventing drift.
- `--dry-run` no longer installs or probes yt-dlp/ffmpeg.
- Successful human-readable downloads print their exact final saved paths.
- History entries now retain final file paths and automatically become fresh
  when all recorded files have been deleted; legacy history remains compatible.
- README onboarding now separates human workflows, agent workflows, safety
  behavior, and the complete command reference.
- CI now tests both runtime behavior and the npm publish payload on Windows,
  macOS, and Linux.
- npm publishing verifies the release tag and uses provenance attestations.

### Compatibility

- Existing `lyt`, `yt3`, and `yt4` commands remain supported.
- Existing flags and config files remain compatible.
- JSON output is additive; human-readable output remains the default.

[0.7.0]: https://github.com/tanattv/lyt/releases/tag/v0.7.0
