# lyt

[![npm version](https://img.shields.io/npm/v/@tanattv/lyt)](https://www.npmjs.com/package/@tanattv/lyt)
[![npm downloads](https://img.shields.io/npm/dm/@tanattv/lyt)](https://www.npmjs.com/package/@tanattv/lyt)
[![CI](https://github.com/tanattv/lyt/actions/workflows/ci.yml/badge.svg)](https://github.com/tanattv/lyt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**A friendly local media CLI for people, scripts, and AI agents.**

`lyt` wraps [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[ffmpeg](https://ffmpeg.org/) with memorable commands, safe defaults, automatic
tool setup, and stable JSON results containing exact final file paths.

```sh
npm install -g @tanattv/lyt

yt3 --mp3 "https://www.youtube.com/watch?v=VIDEO_ID"
yt4 -q 1080p "https://www.youtube.com/watch?v=VIDEO_ID"
```

> Only download media you own or have permission to use. A site's terms may
> restrict downloading even when the media is publicly viewable.

## Why lyt

- `yt3` for audio, `yt4` for video, and `lyt` for the full CLI.
- Friendly quality names such as `1080p`, `4k`, `192K`, and `best`.
- yt-dlp installs automatically on first use.
- ffmpeg installs automatically on Windows; macOS and Linux receive the exact
  package-manager command when it is missing.
- Playlists are disabled unless you explicitly pass `--playlist`.
- Existing files are preserved unless you pass `--force-overwrite`.
- Download history prevents accidental duplicate downloads.
- `--max-filesize` lets people and agents place a hard size guard on a job.
- `--json` emits a versioned result document with absolute final paths.
- A packaged skill can be installed for Codex and Claude with one command.
- Zero runtime npm dependencies.

## Quick start

```sh
# Fast native audio
lyt --audio "URL"

# MP3 audio at 192 kbps
lyt --mp3 -q 192K "URL"

# Video capped at 1080p
lyt --video -q 1080p "URL"

# Save to a specific directory
lyt --mp3 -o "D:/Music" "URL"

# Download several URLs with two workers
lyt --video -q 720p --jobs 2 "URL_1" "URL_2"

# Preview the command without installing tools or downloading media
lyt --video -q 1080p --dry-run "URL"
```

Successful human-readable downloads end with the exact saved path:

```text
Saved: C:\Users\you\Downloads\Example [abc123].mp3
```

## Use lyt with Codex, Claude, and other agents

Install lyt globally, then install its packaged skill:

```sh
npm install -g @tanattv/lyt
lyt agent install all
```

You can install one target instead:

```sh
lyt agent install codex
lyt agent install claude
lyt agent install all --home "/custom/user/home"
```

The installer copies the same maintained skill to:

| Agent | Skill location |
| --- | --- |
| Codex | `~/.codex/skills/lyt/SKILL.md` |
| Claude Code | `~/.claude/skills/lyt/SKILL.md` |

Agents should call lyt with `--json`:

```sh
lyt --mp3 -q 192K --max-filesize 2G --json "URL"
```

stdout contains one JSON document. Progress and setup diagnostics stay on
stderr, so scripts can safely parse stdout.

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

The contract is versioned as `lyt.result.v1`. Consumers should use
`results[].status` and `results[].files` instead of scraping terminal text.
Failed jobs exit non-zero and still return a valid JSON result. History-deduped
jobs use `status: "skipped"` and `reason: "history"`. Size-capped jobs that
produce no file exit non-zero with `reason: "max-filesize"` instead of silently
reporting success.

Other machine-readable operations:

```sh
lyt --list-formats --json "URL"
lyt --video -q 4k --dry-run --json "URL"
```

## Safe download controls

lyt is deliberately conservative by default:

- A playlist URL downloads one video unless `--playlist` is present.
- Existing final files are not overwritten.
- Partial downloads resume when possible.
- Previously downloaded video IDs are skipped using local history.
- Agent calls can cap size with `--max-filesize 500M`, `2G`, or another
  [yt-dlp size value](https://github.com/yt-dlp/yt-dlp#usage-and-options).

Use explicit overrides when intended:

```sh
lyt --playlist "PLAYLIST_URL"
lyt --force-overwrite "URL"
lyt --redownload "URL"
lyt --no-history "URL"
```

## Useful recipes

### Clipboard downloads

```sh
yt3 --paste
yt4 --watch
```

`--paste` reads supported YouTube links already on the clipboard. `--watch`
keeps running and downloads new links until `Ctrl+C`.

### Download a clip

```sh
lyt --mp3 --clip 1:10-2:45 "URL"
lyt --video --clip 12:00- -q 1080p "URL"
```

Ranges accept seconds, `mm:ss`, or `hh:mm:ss`. Repeat `--clip` for multiple
sections.

### Split chapters and normalize audio

```sh
lyt --mp3 --split-chapters "URL"
lyt --normalize "URL"
```

`--normalize` uses ffmpeg's EBU R128 loudness filter and implies MP3.

### Profiles

```sh
lyt --profile music "URL"
lyt --profile podcast "URL"
lyt --profile voice "URL"
```

- `music`: high-quality MP3 with metadata and cover art.
- `podcast`: compact normalized MP3 with metadata.
- `voice`: small normalized speech files.

### See available formats

```sh
lyt --list-formats "URL"
```

### Interactive mode

```sh
lyt --interactive
```

Running `lyt` with no URL in an interactive terminal also opens the prompts.

## Install and requirements

### npm

```sh
npm install -g @tanattv/lyt
```

Requires Node.js 20 or newer. Update with:

```sh
npm update -g @tanattv/lyt
```

### GitHub

```sh
npm install -g github:tanattv/lyt
```

### Source checkout

```sh
git clone https://github.com/tanattv/lyt.git
cd lyt
npm install -g .
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

Windows users can optionally install Explorer context-menu actions:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
```

### Tool discovery and cache

An existing system installation always wins. Otherwise lyt caches managed
binaries here:

| OS | Data directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\lyt` |
| macOS | `~/Library/Application Support/lyt` |
| Linux | `$XDG_DATA_HOME/lyt` or `~/.local/share/lyt` |

Use `--no-download` or `LYT_NO_DOWNLOAD=1` to require tools on `PATH` instead
of allowing managed downloads.

## History, configuration, and diagnostics

```sh
lyt history
lyt history podcast --limit 50
lyt history --clear

lyt config set output-dir "D:/Music"
lyt config set profile music
lyt config list
lyt config unset profile

lyt doctor
lyt doctor --fix
lyt doctor --update
```

Explicit command flags override profiles, which override saved configuration,
which override built-in defaults.

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

| Option | Purpose |
| --- | --- |
| `--audio`, `--video` | Select audio or video mode. |
| `--mp3`, `--native` | Convert to MP3 or preserve native audio. |
| `-q, --quality <value>` | MP3 bitrate or video resolution. |
| `--max-height <value>` | Cap video resolution. |
| `--max-filesize <size>` | Skip media larger than the supplied size. |
| `-o, --output-dir <dir>` | Choose the destination directory. |
| `-j, --jobs <n>` | Run multiple URL downloads in parallel. |
| `-f, --fragments <n>` | Set concurrent fragments per download. |
| `-L, --list-formats` | Inspect available qualities without downloading. |
| `--clip <start-end>` | Download one section; repeatable. |
| `--split-chapters` | Create one file per chapter. |
| `--normalize` | Normalize audio loudness and output MP3. |
| `--paste`, `--watch` | Read once from or continuously watch the clipboard. |
| `--profile <name>` | Use `music`, `podcast`, or `voice`. |
| `--playlist` | Explicitly allow playlist downloads. |
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

## Troubleshooting

Start with:

```sh
lyt doctor
```

Common fixes:

- **PowerShell blocks `npm`:** run `npm.cmd install -g @tanattv/lyt`.
- **ffmpeg is missing on macOS:** run `brew install ffmpeg`.
- **ffmpeg is missing on Debian/Ubuntu:** run `sudo apt install ffmpeg`.
- **A previous download is skipped:** use `lyt history` to confirm it, then
  pass `--redownload` only when another copy is intended.
- **An agent cannot parse output:** add `--json` and parse stdout only.
- **A remote sandbox cannot reach the media host:** run lyt locally; many
  hosted agent environments restrict media traffic.

## Development and release checks

```sh
npm test
npm run check:pack
npm run check
npm run smoke:linux
node bin/lyt.js --dry-run --json --video -q 1080p "URL"
```

`npm run check` runs the full Node test suite and verifies the exact npm
publish payload, including the packaged agent skill.

## License

[MIT](LICENSE)
