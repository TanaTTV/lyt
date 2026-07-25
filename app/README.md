# lyt desktop app

> **Status: experimental.** The v0.8 review branch delegates to the canonical
> lyt engine, but production installers still require desktop CI, packaging,
> signing, and cross-platform validation.

The Tauri application demonstrates a lightweight GUI for searching YouTube and
starting permitted audio or video downloads without typing terminal commands.

## Current prototype

- Search through the canonical `lyt search` command without an API key.
- Resolve a pasted URL through the canonical `lyt inspect` command.
- Toggle audio/video and select a basic quality.
- Stream `lyt.job-event.v1` progress and exact artifact paths.
- Cancel a running sidecar process and retry failed or canceled jobs.
- Choose an output folder.
- Preview the frontend in a browser with mock data.

## Why it is still experimental

The Rust backend now shells out to the canonical lyt sidecar instead of
constructing yt-dlp arguments independently. It inherits the CLI's history,
safe defaults, exact paths, and structured event protocol. The app remains
experimental because it still lacks:

- packaged sidecar discovery outside `LYT_SIDECAR` or PATH;
- persistent job state across restarts;
- signed installers and production updater behavior;
- full desktop CI across Windows, macOS, and Linux.

Maintaining two download engines would create drift. The target architecture is:

```text
Tauri UI
  -> bundled lyt sidecar
  -> lyt JSON / JSONL contract
  -> yt-dlp + ffmpeg
```

The standalone-binary work in the project roadmap should provide the same lyt
sidecar for both non-Node users and the desktop application.

## Layout

```text
app/
  index.html, styles.css   Frontend UI
  app.js                   UI state and interactions
  api.js                   Tauri bridge with browser mock
  src-tauri/               Experimental Rust shell
    src/lib.rs             Current search/resolve/download prototype
    tauri.conf.json        Window and bundle configuration
    capabilities/          Tauri permissions
```

## Preview the UI

```sh
cd app
python3 -m http.server 8000
# open http://localhost:8000
```

## Local Tauri development

Requires Rust, the Tauri v2 prerequisites, yt-dlp, ffmpeg, and a pinned Tauri
CLI version before production work resumes.

```sh
cd app
npx @tauri-apps/cli dev
npx @tauri-apps/cli build
```

## Required before a public desktop release

- Bundle and locate the reviewed lyt sidecar on every target platform.
- Validate structured progress, exact paths, cancellation, and retry in desktop CI.
- Pin frontend/build tooling and add a lockfile.
- Run formatting, clippy, tests, and builds on pull requests.
- Sign Windows installers and notarize macOS builds.
- Define tool bundling, licensing, updates, and uninstall behavior.

Track implementation in [`../ROADMAP.md`](../ROADMAP.md). Until those items are
complete, the CLI is the production product and the desktop application is a
prototype.
