# AGENTS.md

## Cursor Cloud specific instructions

`lyt` is a zero-runtime-dependency Node.js CLI (Node 20+) that wraps `yt-dlp`
and `ffmpeg`. The npm package and the `website/` static site have **no npm
dependencies and no lockfiles**, so `npm install` is a no-op. Do not expect a
`node_modules` directory.

### Services / surfaces
- CLI (production product): entry points `bin/lyt.js`, `bin/yt3.js`,
  `bin/yt4.js`. Run directly, e.g. `node bin/lyt.js --help`.
- Website (`website/`): dependency-free static site. Standard commands live in
  `website/package.json` (`build`, `check`, `serve`). `npm run serve` listens on
  `127.0.0.1:4173`.
- Desktop app (`app/`): experimental Tauri prototype, explicitly NOT part of the
  release (see `app/README.md`). Requires Rust/Tauri toolchain; out of scope for
  normal development.

### Lint / test / build / run
- There is no separate lint step in this repo. Standard commands are in
  `package.json` and `README.md` (`npm test`, `npm run check:pack`,
  `npm run check:website`, `npm run check`, `npm run smoke:linux`).
- `npm run check` runs the Node test suite + npm-pack payload verification +
  website build/SEO checks.
- `npm run smoke:linux` packs the CLI, installs it globally to a temp prefix,
  and performs a real permitted download from Wikimedia Commons (needs network
  + a provisioned `yt-dlp`).

### yt-dlp provisioning (non-obvious)
- `ffmpeg` is preinstalled system-wide, but `yt-dlp` is NOT on `PATH`.
- `lyt` manages its own checksum-verified `yt-dlp` binary under
  `~/.local/share/lyt/bin/`. The startup update script runs
  `node bin/lyt.js doctor --fix` to provision it ahead of time; the CLI also
  auto-downloads it on first real use. The unit tests do NOT need `yt-dlp`
  (they mock it), so tests pass even before provisioning.
- Provisioning and real downloads need outbound network (GitHub releases for
  the binary, and the media host). Use `lyt doctor` to confirm readiness.
- Clipboard integration is unavailable on this headless Linux VM (no
  xclip/xsel/wl-clipboard); `--paste`/`--watch` will not work here.
