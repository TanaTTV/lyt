# lyt desktop app

> **Status: experimental.** The desktop UI is a design and integration
> prototype, not part of the lyt CLI v0.7.2 release. Do not publish production
> installers until the app uses the canonical lyt engine and passes desktop CI.

The Tauri application demonstrates a lightweight GUI for searching YouTube and
starting permitted audio or video downloads without typing terminal commands.

## Current prototype

- Search YouTube through yt-dlp's built-in search without an API key.
- Resolve a pasted URL.
- Toggle audio/video and select a basic quality.
- Show download progress.
- Choose an output folder.
- Preview the frontend in a browser with mock data.

## Why it is still experimental

The Rust backend currently shells out to yt-dlp and builds download arguments
independently. It does **not** yet inherit all behavior from the tested Node CLI,
including:

- verified managed tool setup;
- variant-aware history;
- profiles, clips, chapters, and size guards;
- `lyt.result.v1` exact final paths;
- capability-aware diagnostics;
- agent permission guidance;
- future fixes made in the canonical CLI engine.

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

- Replace independent Rust download argument construction with the lyt sidecar.
- Stream structured progress and exact final artifact paths.
- Drain stdout and stderr safely and support cancellation/retry.
- Resolve output directories without literal `~` paths.
- Register event listeners before starting jobs.
- Add a restrictive content security policy.
- Pin frontend/build tooling and add a lockfile.
- Run formatting, clippy, tests, and builds on pull requests.
- Sign Windows installers and notarize macOS builds.
- Define tool bundling, licensing, updates, and uninstall behavior.

Track implementation in [`../ROADMAP.md`](../ROADMAP.md). Until those items are
complete, the CLI is the production product and the desktop application is a
prototype.
