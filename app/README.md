# lyt desktop app

A lightweight desktop GUI for **lyt**, built with [Tauri](https://tauri.app)
(Rust shell + the OS's native webview). It lets you **search YouTube and
download** audio or video without touching a terminal.

> Status: **design + frontend complete and verified by screenshot**; the Tauri
> Rust backend is in place but needs a local Tauri toolchain to build (it
> cannot be compiled in the headless CI sandbox). See "Verified vs. to-build".

## What it does

- **Search YouTube right in the app** (powered by `yt-dlp`'s built-in search —
  no API key needed), or paste a link.
- Toggle **Audio / Video** and pick a **quality** (MP3 bitrate, or up to 4K/8K).
- A **downloads panel** shows live progress per item.
- Choose the output folder.

## Architecture

```
app/
  index.html, styles.css   The UI
  app.js                   UI logic
  api.js                   Backend bridge: Tauri invoke(), with a browser mock
  src-tauri/               Tauri (Rust) shell
    src/lib.rs             Commands: search, resolve, start_download (-> yt-dlp)
    tauri.conf.json        Window + bundle config
    capabilities/          Permissions
```

The frontend talks to a small `api` layer. Inside Tauri it calls the Rust
commands; in a plain browser it uses mock data, so the UI is fully viewable
during design without a build.

`src-tauri/src/lib.rs` shells out to `yt-dlp` for search and downloads and
streams progress back to the UI as `progress:{id}` events.

## Requirements to build

- [Rust](https://rustup.rs/) and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)
  (on Linux: `webkit2gtk-4.1`, `libappindicator`, etc.).
- `yt-dlp` and `ffmpeg` on PATH at runtime.
- The Tauri CLI: `npm install -g @tauri-apps/cli` (or `cargo install tauri-cli`).

## Run it

```bash
# from the app/ folder
npx @tauri-apps/cli icon icons/icon.png   # one-time: generate icon formats
npx @tauri-apps/cli dev                    # launch the app
npx @tauri-apps/cli build                  # produce installers
```

## Preview the UI without Tauri

The frontend runs in any browser using mock data:

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000
```

## Verified vs. to-build

- ✅ **Frontend** (layout, theme, interactions, audio/video toggle, search
  results, downloads panel) — rendered and screenshotted with headless
  Chromium.
- ⚙️ **Rust backend** — written against Tauri v2 conventions but **not compiled
  in CI** (the sandbox lacks the webview system libraries). Build it locally
  with the Tauri toolchain above.

## Open question

`yt-dlp`/`ffmpeg` are still required at runtime. We can either detect and prompt
to install them (current behavior) or bundle them with the app (larger, needs
an update story). See repo issues for the tracking discussion.
