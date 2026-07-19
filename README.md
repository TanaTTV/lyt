<p align="center">
  <img
    src="https://raw.githubusercontent.com/TanaTTV/lyt/main/app/src-tauri/icons/icon.png"
    width="112"
    alt="lyt purple feather logo"
  />
</p>

<h1 align="center">lyt</h1>

<p align="center">
  <strong>Download media without fighting the terminal.</strong><br />
  A fast, local-first CLI built for people, scripts, and AI agents.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tanattv/lyt"><img alt="npm version" src="https://img.shields.io/npm/v/@tanattv/lyt?style=for-the-badge&color=8b5cf6" /></a>
  <a href="https://www.npmjs.com/package/@tanattv/lyt"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@tanattv/lyt?style=for-the-badge&color=22d3ee" /></a>
  <a href="https://github.com/TanaTTV/lyt/actions/workflows/ci.yml"><img alt="build status" src="https://img.shields.io/github/actions/workflow/status/TanaTTV/lyt/ci.yml?branch=main&style=for-the-badge&label=build" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/TanaTTV/lyt?style=for-the-badge&color=171a21" /></a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#built-for-agents">Agents</a> ·
  <a href="#recipes">Recipes</a> ·
  <a href="#command-reference">Reference</a>
</p>

---

```console
$ npm install --global @tanattv/lyt
$ lyt --video -q 1080p "URL"

Saved: C:\Users\you\Downloads\Example [abc123].mp4
```

`lyt` gives [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[ffmpeg](https://ffmpeg.org/) a smaller, friendlier interface. Tools install
automatically on first use, sensible safety controls are on by default, and
every successful download tells you exactly where the file landed.

> [!IMPORTANT]
> Only download media you own or have permission to use. A site's terms may
> restrict downloading even when media is publicly viewable.

## Why lyt

| Friendly for people | Reliable for automation | Local by default |
| --- | --- | --- |
| Memorable `yt3` and `yt4` shortcuts | Stable `lyt.result.v1` JSON | Files and history stay on your machine |
| Quality names like `1080p`, `4k`, and `192K` | Exact final paths after conversion | No account, hosted service, or runtime dependencies |
| Clipboard, profiles, clips, and prompts | Size guards and meaningful exit codes | Managed tools live in a predictable local cache |

## Install

### 1. Install the CLI

```sh
npm install --global @tanattv/lyt
```

Requires Node.js 20 or newer.

### 2. Check your setup

```sh
lyt doctor
```

### 3. Download something

```sh
# Fast native audio
lyt --audio "URL"

# MP3 at 192 kbps
lyt --mp3 -q 192K "URL"

# Video capped at 1080p
lyt --video -q 1080p "URL"
```

That is the complete setup. `lyt` finds or installs yt-dlp automatically and
guides you through ffmpeg setup when it is needed.

## Quick start

| I want to… | Command |
| --- | --- |
| save native audio quickly | `yt3 "URL"` |
| create an MP3 | `lyt --mp3 -q 192K "URL"` |
| save a 1080p video | `yt4 -q 1080p "URL"` |
| choose a folder | `lyt --mp3 -o "D:/Music" "URL"` |
| preview without downloading | `lyt --video -q 1080p --dry-run "URL"` |
| use interactive prompts | `lyt --interactive` |
| inspect available qualities | `lyt --list-formats "URL"` |

Download several URLs with two workers:

```sh
lyt --video -q 720p --jobs 2 "URL_1" "URL_2"
```

## Built for agents

lyt is designed to work cleanly inside Codex, Claude Code, scripts, and other
automation without scraping terminal text.

Install the maintained agent skill:

```sh
lyt agent install all
```

Or choose one target:

```sh
lyt agent install codex
lyt agent install claude
lyt agent install all --home "/custom/user/home"
```

| Agent | Installed skill |
| --- | --- |
| Codex | `~/.codex/skills/lyt/SKILL.md` |
| Claude Code | `~/.claude/skills/lyt/SKILL.md` |

For machine-readable jobs, add `--json`:

```sh
lyt --mp3 -q 192K --max-filesize 2G --json "URL"
```

```json
{
  "schema": "lyt.result.v1",
  "version": "0.7.0",
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
to stderr. Failed jobs exit non-zero while still returning valid JSON.

- Downloaded files: `results[].files`
- History dedupe: `status: "skipped"`, `reason: "history"`
- Size guard: non-zero result with `reason: "max-filesize"`
- Contract schema: [`schemas/lyt.result.v1.schema.json`](schemas/lyt.result.v1.schema.json)

## Safe by default

lyt makes potentially destructive behavior explicit:

- Playlist URLs download one video unless `--playlist` is present.
- Existing final files are preserved unless `--force-overwrite` is present.
- Partial downloads resume when possible.
- Local history prevents accidental duplicate downloads.
- `--max-filesize 500M` or `2G` gives agents and people a hard size guard.
- `--dry-run` installs nothing and downloads nothing.

Use an override only when you mean it:

```sh
lyt --playlist "PLAYLIST_URL"
lyt --force-overwrite "URL"
lyt --redownload "URL"
lyt --no-history "URL"
```

## Recipes

### Download from the clipboard

```sh
yt3 --paste     # download links currently on the clipboard
yt4 --watch     # keep watching for newly copied links
```

Stop watch mode with `Ctrl+C`.

### Grab only part of a video

```sh
lyt --mp3 --clip 1:10-2:45 "URL"
lyt --video --clip 12:00- -q 1080p "URL"
```

Ranges accept seconds, `mm:ss`, or `hh:mm:ss`. Repeat `--clip` to save
multiple sections.

### Split chapters or normalize audio

```sh
lyt --mp3 --split-chapters "URL"
lyt --normalize "URL"
```

`--normalize` uses ffmpeg's EBU R128 loudness filter and implies MP3.

### Use a ready-made profile

```sh
lyt --profile music "URL"     # high-quality MP3 + metadata + cover art
lyt --profile podcast "URL"   # compact normalized MP3 + metadata
lyt --profile voice "URL"     # small normalized speech file
```

## History, configuration, and diagnostics

```sh
# Find or clear previous downloads
lyt history
lyt history podcast --limit 50
lyt history --clear

# Save defaults
lyt config set output-dir "D:/Music"
lyt config set profile music
lyt config list
lyt config unset profile

# Check or repair tools
lyt doctor
lyt doctor --fix
lyt doctor --update
```

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

### Use the helper installers

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

macOS or Linux:

```sh
bash install/install.sh
```

Windows Explorer context-menu actions are optional:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
```

### Managed tool locations

An existing system tool always wins. Otherwise managed binaries are cached at:

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
yt3 <url>   # audio shortcut
yt4 <url>   # video shortcut

lyt history [query] [--limit <n>] [--clear]
lyt config <set|get|unset|list|path> [key] [value]
lyt doctor [--fix] [--update]
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
| `--no-download` | Disable automatic tool downloads. |
| `--print-command` | Show the yt-dlp command before execution. |
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
| A previous download is skipped | Check `lyt history`, then use `--redownload` if another copy is intentional. |
| An agent cannot parse output | Add `--json` and parse stdout only. |
| A remote sandbox cannot reach the host | Run lyt locally; many hosted environments restrict media traffic. |

## Development

```sh
npm test
npm run check:pack
npm run check
npm run smoke:linux
```

`npm run check` runs the complete Node test suite and verifies the exact npm
publish payload, including the packaged agent skill and JSON Schema.

## License

[MIT](LICENSE) · Built on [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[ffmpeg](https://ffmpeg.org/).
