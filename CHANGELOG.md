# Changelog

All notable changes to lyt are documented here. This project follows semantic
versioning for the public CLI and machine-readable result contract.

## [Unreleased]

### Changed

- New logo: the "y" in lyt drawn as two paths merging into one download
  arrow (you and your agent, one exact file). Used across the website, README,
  plugin, and application icons.
- Redesigned website positioned around AI agents: searchable command
  reference, use cases, task guides, FAQ structured data, self-hosted font,
  new social card, and an expanded `llms.txt` with request-to-command examples.

## [0.8.2] - 2026-10-02

### Added

- **Spotify** playlist, album, track, and artist (top tracks) links download as
  songs. lyt reads the public track list, finds each song on YouTube, and saves
  MP3s to `<output>/<playlist>/NN - Artist - Title.mp3`. lyt never downloads
  Spotify audio itself.
  - Matching compares song length: the first of the top five YouTube results
    within a few seconds of the Spotify track wins, falling back to the top
    result. `--json` reports each song's `source` and matched video (`match`).
  - Files are tagged with the Spotify artist, title, album, and track number,
    and get the album cover embedded.
  - A `<playlist>.m3u8` file lists the songs in Spotify order.
  - Songs already on disk are skipped (`skipped` / `exists` in `--json`) even
    after the playlist order changes. `--sync` renumbers saved songs and moves
    songs that left the playlist to a `removed` folder.
  - Three songs download at a time unless `-j` is set.
  - Playlists over 100 songs: optional `spotify-client-id` /
    `spotify-client-secret` config (or `LYT_SPOTIFY_CLIENT_ID` /
    `LYT_SPOTIFY_CLIENT_SECRET`) reads the full list through Spotify's Web API.
    Without keys, lyt warns that only the first 100 songs are public.
  - `lyt info <spotify link>` lists the songs without downloading.
- Subtitles: `--subs`, `--sub-langs`, `--embed-subs`, `--no-subs`. A subtitle
  failure (for example a rate limit) no longer fails the download; the media
  is saved and the result carries a `warning`.
- `--sponsorblock` cuts sponsor, self-promo, and interaction segments.
- `--cookies-from-browser` and `--cookies` for media your own account can
  access (opt-in only).
- `-r, --limit-rate` and `--retries`.
- `-a, --batch-file <file>` reads URLs from a file or standard input.
- With `--playlist`, playlists, channels, and sets save into their own folder,
  numbered in playlist order (when no custom `--template` is set).
- Audio downloads with `--embed-thumbnail` (including `--profile music`) crop
  the video thumbnail to a square cover.
- Config keys: `video`, `max-height`, `max-filesize`, `playlist`, `history`,
  `subs`, `sub-langs`, `embed-subs`, `sponsorblock`, `limit-rate`, `retries`,
  `cookies-from-browser`, `spotify-client-id`, `spotify-client-secret`.
  Secrets are masked in `lyt config` output.
- `lyt doctor --network` checks that YouTube, Spotify, SoundCloud, and GitHub
  are reachable.
- Runs with several items end with a summary (`Done: 12 saved · 3 skipped`).
- History records titles, uploader, site, and page URL; `lyt history` shows
  titles and searches them.
- `--json` results include `title`, `extractor`, and `webpageUrl` when known,
  and the envelope can carry `warnings`.
- `scripts/bump-version.js` sets the release version in every file the
  release checks verify.

### Changed

- Clearer human terminal output: color on doctor, help, info, capabilities,
  history, and progress when the terminal supports it (honors `NO_COLOR` /
  `FORCE_COLOR`), unicode progress bars on capable terminals, and single-URL
  downloads use the same live bar instead of raw yt-dlp lines. `--json` and
  piped output stay plain.
- Clipboard paste and `--watch` pick up YouTube, Spotify, SoundCloud, Vimeo,
  and Bandcamp links (previously YouTube only). Watch mode expands Spotify
  links and skips collections unless `--playlist` is set.
- `yt3` / `yt4` choose the mode even when config sets `video`.
- `-q` with a bare number above 10 means a bitrate (`320` → `320K`); 0-10
  remain VBR levels.
- `lyt capabilities` advertises every new flag plus `--no-normalize`,
  `--no-playlist`, `--no-part`, and `--print-command`.
- Interactive mode asks for any media URL, not only YouTube.
- Schema `$id`s consistently point at the main branch.

### Fixed

- **Playlist opt-in was bypassed by playlist-only links.** yt-dlp's
  `--no-playlist` only affects a video inside a playlist, so a
  `youtube.com/playlist` link, a channel, or a SoundCloud set downloaded every
  item. lyt now refuses these without `--playlist` (exit code 2).
- History dedupe works for every site (by normalized URL or the page URL
  yt-dlp reports), not only YouTube video IDs. Playlists and channels stay
  fresh so new items are found.
- `--paste` no longer ignores copied Spotify and SoundCloud links.
- Stopping `--watch` with Ctrl+C during a download reports an interruption
  instead of an error, keeps the partial file for resume, and removes its
  signal handlers.
- `lyt config set` rejects invalid values up front instead of saving them and
  failing every later download.
- YouTube `/embed/` links are recognized for paste, watch mode, and history
  dedupe.
- `--list-formats` and `lyt info` share one metadata path (removed duplicate
  code).

### Compatibility

- No breaking changes to `lyt.result.v1`, `lyt.info.v1`, or other schemas;
  new fields are optional additions. The only behavior change for scripts is
  the playlist-link refusal above, which matches the documented contract.

## [0.8.1] - 2026-10-02

### Fixed

- Match existing artifacts before preparing tools, so history-only downloads do
  not require executable probes or managed installation.
- Allow bounded 15-second yt-dlp cold-start checks and report an unusable installed
  executable separately from a missing tool. Doctor reuses successful probe output.
- Classify a missing output as a size-limit skip only when yt-dlp reports the limit.
- Bound metadata extraction to 60 seconds and 16 MiB of combined output, terminating
  the child process on timeout or excess output.
- Validate complete versions and compare prereleases correctly for upgrade notices.
- Refresh release information after the installed version changes; cache failures
  never fail the media operation and offline checks back off for five minutes.

- Install direct Codex skills in the documented user discovery location,
  `~/.agents/skills`, and verify that location in clean packed installs.
- Include AI.md and its security-policy link in the npm publish payload.
- Synchronize README examples and plugin versions with the CLI release.

### Added

- Searchable task guides for Codex audio, Claude Code video, and agent clips,
  linked from the agent guide, sitemap, and both AI reference files.
- Release consistency checks, directory preparation instructions, and a
  natural-language skill selection evaluation fixture.

### Changed

- Load help, version, and subcommands without the full download engine.
- Inspect up to three URLs concurrently by default; `info` / `inspect --jobs 1-16`
  controls concurrency while preserving result order and partial failures.
- Cache successful npm release checks for six hours. `doctor --check-updates` forces
  a fresh check, and human download checks run alongside the job.
- Label stale release information explicitly. JSON download/inspection behavior
  and update opt-outs are preserved; no automatic self-update is introduced.
- Agent guidance favors batched calls and reuses session discovery results.

- Clarify plugin listing metadata, requirements, and local execution limits.


## [0.8.0] - 2026-09-30

### Added

- `lyt info <url>` (alias `lyt inspect`) reports media metadata and available
  formats without downloading, emitting `lyt.info.v1` with `--json` (title,
  uploader, duration, live status, and per-format codec/size/bitrate details).
- `lyt capabilities` returns a self-describing manifest of commands, modes,
  flags, profiles, result schemas, and exit codes as `lyt.capabilities.v1` with
  `--json`, so agents can discover the surface without scraping help text.
- `AGENTS.md` with Cursor Cloud environment notes for zero-dependency setup.

### Changed

- Agent skills remove blanket license-attestation gates for ordinary local
  downloads and distinguish file retrieval from publication clearance.
- Agents reuse existing authorization, complete authorized jobs, and report
  exact saved paths instead of repeatedly asking for confirmation.
- Metadata inspection examples use `--no-download` to prevent unapproved
  managed tool provisioning. Setup and network errors are distinguished from
  policy decisions.
- Codex, Claude, plugin, and website AI guidance are synchronized. Governing
  provider policies still apply; Content ID preferences do not establish rights.
- CI verifies clean packed installs and direct skill installation on Windows,
  macOS, and Linux, alongside the existing permitted-media integration test.
- Internal modular cleanup (merged via #41): single public router in `entry.js`,
  download engine in `download.js` / `process.js`, subcommands under
  `src/commands/`, shared `errors.js` helpers.

## [0.7.4] - 2026-08-12

### Added

- Quiet “update available” notices when a newer lyt is published on npm.
  Human downloads, `lyt doctor`, and `lyt --version` may check the registry
  (cached about 24 hours) and print an install command on stderr. JSON/agent
  runs stay silent. Disable with `LYT_NO_UPDATE_CHECK=1` or
  `lyt config set update-check false`.

### Compatibility

- No breaking CLI or result-contract changes.
- Update checks are optional and never fail a download.

## [0.7.3] - 2026-08-12

### Added

- Interactive terminals auto-read YouTube URLs from the clipboard when no URL
  argument is given, so the default workflow is copy a link and run `lyt`.
  Explicit `--paste` still works everywhere, including scripts and non-TTY
  runs. `--json` and non-interactive invocations never read the clipboard
  unless `--paste` is set.

### Changed

- Docs and CLI help now present `yt3` and `yt4` as optional aliases, with `lyt`
  as the primary interface.

### Fixed

- YouTube downloads and format inspection now reuse lyt's supported Node.js
  executable as yt-dlp's JavaScript runtime, avoiding extractor failures when
  no separate runtime such as Deno is installed.

### Compatibility

- Existing `lyt`, `yt3`, and `yt4` commands remain supported.
- Explicit URL arguments, `--paste`, `--watch`, and agent `--json` behavior are
  unchanged aside from the TTY auto-clipboard path above.

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
[0.7.3]: https://github.com/TanaTTV/lyt/releases/tag/v0.7.3
[0.7.4]: https://github.com/TanaTTV/lyt/releases/tag/v0.7.4
