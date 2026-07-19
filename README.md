<p align="center">
  <img src="https://raw.githubusercontent.com/TanaTTV/lyt/main/app/src-tauri/icons/icon.png" width="112" alt="lyt red feather-bolt logo" />
</p>

<h1 align="center">lyt</h1>

<p align="center">
  <strong>Download media without fighting the terminal.</strong><br />
  A fast, local-first CLI built for people, scripts, and AI agents.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tanattv/lyt"><img alt="npm version" src="https://img.shields.io/npm/v/@tanattv/lyt?style=for-the-badge&color=ff1f3d" /></a>
  <a href="https://www.npmjs.com/package/@tanattv/lyt"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@tanattv/lyt?style=for-the-badge&color=22d3ee" /></a>
  <a href="https://github.com/TanaTTV/lyt/actions/workflows/ci.yml"><img alt="build status" src="https://img.shields.io/github/actions/workflow/status/TanaTTV/lyt/ci.yml?branch=main&style=for-the-badge&label=build" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/TanaTTV/lyt?style=for-the-badge&color=171a21" /></a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#built-for-agents">Agents</a> ·
  <a href="#recipes">Recipes</a> ·
  <a href="#command-reference">Reference</a> ·
  <a href="https://tanattv.github.io/lyt/">Website</a> ·
  <a href="AI.md">AI facts</a>
</p>

---

```console
$ npm install --global @tanattv/lyt
$ lyt --video -q 1080p "URL"

Saved: C:\Users\you\Downloads\Example [abc123].mp4
```

`lyt` gives [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[ffmpeg](https://ffmpeg.org/) a smaller, friendlier interface. It can provision
checksum-verified yt-dlp binaries automatically. On Windows it can also
provision a verified ffmpeg build; on macOS and Linux, `lyt doctor` provides the
correct package-manager command when ffmpeg is needed.

> [!IMPORTANT]
> Only download media you own or have permission to use. A site's terms may
> restrict downloading even when media is publicly viewable.

## Why lyt

| Friendly for people | Reliable for automation | Local by default |
| --- | --- | --- |
| Memorable `yt3` and `yt4` shortcuts | Stable `lyt.result.v1` JSON | Files, config, and history stay on your machine |
| Quality names like `1080p`, `4k`, and `192K` | Exact final paths after conversion | No lyt account or hosted service |
| Clipboard, profiles, clips, and prompts | Variant-aware history and meaningful exit codes | Zero npm runtime dependencies |
| Capability-aware `lyt doctor` | One JSON document on stdout | Managed tools use a predictable local cache |

## Install

### 1. Install the CLI

```sh
npm install --global @tanattv/lyt
```

Requires Node.js 20 or newer.

### 2. Check your capabilities

```sh
lyt doctor
```

`doctor` separates core readiness from optional capabilities. Native audio needs
Node and yt-dlp. MP3 conversion, video merging, clips, chapters, thumbnails, and
normalization also require ffmpeg.

### 3. Download something

```sh
# Fast native audio
lyt --audio "URL"

# MP3 at 192 kbps
lyt --mp3 -q 192K "URL"

# Video capped at 1080p
lyt --video -q 1080p "URL"
```

## Quick start

| I want to… | Command |
| --- | --- |
| save native audio quickly | `yt3 "URL"` |
| create an MP3 | `lyt --mp3 -q 192K "URL"` |
| save a 1080p video | `yt4 -q 1080p "URL"` |
| choose a folder | `lyt --mp3 -o "D:/Music" "URL"` |
| preview without installing or downloading | `lyt --video -q 1080p --dry-run "URL"` |
| use interactive prompts | `lyt --interactive` |
| inspect available qualities | `lyt --list-formats "URL"` |
| diagnose the environment as JSON | `lyt doctor --json` |

Download several URLs with two workers:

```sh
lyt --video -q 720p --jobs 2 "URL_1" "URL_2"
```

Repeated direct URLs in one invocation are removed before work begins.

## Built for agents

lyt is designed for Codex, Claude Code, Gemini CLI, scripts, and other
terminal-capable automation without scraping terminal text. The maintained
[AI facts](AI.md), [website AI page](https://tanattv.github.io/lyt/ai/), and
[llms.txt](https://tanattv.github.io/lyt/llms.txt) provide canonical product
information.

Install the CLI first, with the user's approval:

```sh
npm install --global @tanattv/lyt
lyt doctor
```

Install the direct skills:

```sh
lyt agent install codex
lyt agent install claude
lyt agent install all
```

Compatible Codex and Claude Code versions can also use the repository
marketplace packages:

```sh
codex plugin marketplace add TanaTTV/lyt
codex plugin add lyt@lyt-plugins

claude plugin marketplace add TanaTTV/lyt
claude plugin install lyt@lyt-plugins
```

For bounded machine-readable jobs, add `--json`:

```sh
lyt --mp3 -q 192K --max-filesize 2G --json "URL"
```

```json
{
  "schema": "lyt.result.v1",
  "version": "0.7.2",
  "command": "download",
  "ok": true,
  "results": [
    {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID",
      "videoId": "VIDEO_ID",
      "status": "downloaded",
      "mode": "audio",
      "files": ["C:\\Users\\you\\Downloads\\Example [VIDEO_ID].mp3"],
      "outputDir": "C:\\Users\\you\\Downloads"
    }
  ]
}
```

stdout contains one versioned JSON document. Progress and setup diagnostics go
to stderr. `--print-command` is suppressed in JSON mode so it cannot corrupt the
machine-readable document.

- Downloaded files: `results[].files`
- History dedupe: `status: "skipped"`, `reason: "history"`
- Size guard: non-zero result with `reason: "max-filesize"`
- Result schema: [`schemas/lyt.result.v1.schema.json`](schemas/lyt.result.v1.schema.json)
- Marketplace package: [`plugins/lyt`](plugins/lyt)
- Demo kit: [`demos/agent-to-file`](demos/agent-to-file)

Agents must ask before global installation, managed tool downloads, playlist
mode, overwrites, authentication material, or external downloaders.

## Safe by default

- Playlist URLs download one item unless `--playlist` is present.
- Existing final files are preserved unless `--force-overwrite` is present.
- Partial downloads resume when possible.
- History dedupe distinguishes audio, MP3, video quality, clips, and output variants.
- `--max-filesize 500M` or `2G` gives agents and people a hard size guard.
- `--dry-run` installs nothing and downloads nothing.
- Downloads are isolated behind `--` before reaching yt-dlp, preventing URL-as-option injection.
- Managed binaries are size-limited, checksum-verified, written atomically, and protected by an install lock.

Use an override only when you mean it:

```sh
lyt --playlist "PLAYLIST_URL"
lyt --force-overwrite --redownload "URL"
lyt --redownload "URL"
lyt --no-history "URL"
```

## Recipes

### Clipboard downloads

```sh
yt3 --paste     # download supported links currently on the clipboard
yt4 --watch     # watch for newly copied links until Ctrl+C
```

### Grab part of a video

```sh
lyt --mp3 --clip 1:10-2:45 "URL"
lyt --video --clip 12:00- -q 1080p "URL"
```

Ranges accept seconds, `mm:ss`, or `hh:mm:ss`. Repeat `--clip` to save
multiple sections.

### Chapters and normalized audio

```sh
lyt --mp3 --split-chapters "URL"
lyt --normalize "URL"
```

`--normalize` uses ffmpeg's EBU R128 loudness filter and implies MP3.

### Ready-made profiles

```sh
lyt --profile music "URL"     # high-quality MP3 + metadata + cover art
lyt --profile podcast "URL"   # compact normalized MP3 + metadata
lyt --profile voice "URL"     # small normalized speech file
```

## History, configuration, and diagnostics

```sh
# Find, search, or clear previous downloads
lyt history
lyt history podcast --limit 50
lyt history --limit 50 --json
lyt history --clear

# Save defaults
lyt config set output-dir "D:/Music"
lyt config set profile music
lyt config list
lyt config unset profile

# Check or repair tools
lyt doctor
lyt doctor --json
lyt doctor --fix
lyt doctor --update
```

A malformed config is moved aside with a `.corrupt-<timestamp>` suffix instead
of being ignored silently. Config writes use a complete temporary file before
replacement.

Command flags override profiles, profiles override saved configuration, and
saved configuration overrides built-in defaults.

<details>
<summary><strong>More installation options</strong></summary>

### Install directly from GitHub

```sh
npm install --global github:TanaTTV/lyt
```

### Install from a source checkout

```sh
git clone https://github.com/TanaTTV/lyt.git
cd lyt
npm install --global .
```

### Helper installers

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

macOS or Linux:

```sh
bash install/install.sh
```

Optional Windows Explorer actions:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
```

### Managed tool locations

| OS | Data directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\lyt` |
| macOS | `~/Library/Application Support/lyt` |
| Linux | `$XDG_DATA_HOME/lyt` or `~/.local/share/lyt` |

Use `--no-download` or `LYT_NO_DOWNLOAD=1` to require tools on `PATH`.

</details>

## Command reference

```text
lyt [options] <url> [more-urls...]
yt3 <url>   # native-audio shortcut
yt4 <url>   # video shortcut

lyt history [query] [--limit <n>] [--clear] [--json]
lyt config <set|get|unset|list|path> [key] [value]
lyt doctor [--fix] [--update] [--json]
lyt agent install [codex|claude|all] [--home <dir>]
```

<details>
<summary><strong>Show every CLI option</strong></summary>

| Option | Purpose |
| --- | --- |
| `--audio`, `--video` | Select audio or video mode. |
| `--mp3`, `--native` | Convert to MP3 or preserve native audio. |
| `-q, --quality <value>` | Set MP3 bitrate or video resolution. |
| `--max-height <value>` | Cap video resolution. |
| `--max-filesize <size>` | Skip media larger than the supplied size. |
| `-o, --output-dir <dir>` | Choose the destination directory. |
| `-j, --jobs <n>` | Run multiple URL downloads in parallel. |
| `-f, --fragments <n>` | Set concurrent fragments per download. |
| `-L, --list-formats` | Inspect available qualities without downloading. |
| `--clip <start-end>` | Download one section; repeatable. |
| `--split-chapters` | Create one file per chapter. |
| `--normalize`, `--no-normalize` | Enable or disable inherited normalization. |
| `--paste`, `--watch`, `--queue` | Read once from or continuously watch the clipboard. |
| `--profile <name>` | Use `music`, `podcast`, or `voice`. |
| `--playlist`, `--no-playlist` | Allow a playlist or force a single item. |
| `--force-overwrite` | Replace existing files. |
| `--redownload` | Bypass history dedupe. |
| `--no-history` | Do not read or write history for this run. |
| `--embed-metadata` | Embed media metadata. |
| `--embed-thumbnail` | Embed the thumbnail. |
| `--template <template>` | Supply a custom yt-dlp output template. |
| `--downloader <name>` | Use an external downloader such as aria2c. |
| `--downloader-args <args>` | Pass arguments to the external downloader. |
| `--no-part` | Disable `.part` files. |
| `--no-download` | Disable automatic managed tool downloads. |
| `--print-command` | Show an inert yt-dlp argv preview before execution in human mode. |
| `--dry-run` | Preview without downloading or installing tools. |
| `--json` | Emit the `lyt.result.v1` machine-readable contract. |
| `-i, --interactive` | Open interactive prompts. |
| `-h, --help` | Show built-in help. |
| `-v, --version` | Show the installed version. |

</details>

## Troubleshooting

Start with:

```sh
lyt doctor
```

| Problem | Fix |
| --- | --- |
| PowerShell blocks `npm` | Run `npm.cmd install --global @tanattv/lyt`. |
| ffmpeg is missing on macOS | Run `brew install ffmpeg`. |
| ffmpeg is missing on Debian/Ubuntu | Run `sudo apt install ffmpeg`. |
| A matching variant is skipped | Check `lyt history`, then use `--redownload` if another copy is intentional. |
| An agent cannot parse output | Add `--json` and parse stdout only. |
| A remote sandbox cannot reach the host | Run lyt locally; many hosted environments restrict media traffic. |

## Development

```sh
npm test
npm run check:pack
npm run check:website
npm run check
npm run smoke:linux
```

`npm run check` runs the Node test suite, verifies the exact npm publish payload,
and builds and validates every public website page.

The product website lives in [`website/`](website/). GitHub Pages publishes the
verified build after website changes reach `main`.

See [`docs/repository-layout.md`](docs/repository-layout.md) for the folder map,
[`docs/releasing.md`](docs/releasing.md) for the release process, and
[`ROADMAP.md`](ROADMAP.md) for intentionally deferred product work.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
opening a pull request and send security-sensitive findings through the private
process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) · Built on [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[ffmpeg](https://ffmpeg.org/).
