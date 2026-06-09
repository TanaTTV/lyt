# lyt

[![npm version](https://img.shields.io/npm/v/@tanattv/lyt)](https://www.npmjs.com/package/@tanattv/lyt)
[![npm downloads](https://img.shields.io/npm/dm/@tanattv/lyt)](https://www.npmjs.com/package/@tanattv/lyt)
[![CI](https://github.com/tanattv/lyt/actions/workflows/ci.yml/badge.svg)](https://github.com/tanattv/lyt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Tired of sketchy ad-filled websites just to download a YouTube video?

`lyt` kills that workflow. One command, clean output, no browser needed.

```sh
yt3 "https://youtube.com/watch?v=VIDEO_ID"           # grab audio
yt4 -q 1080p "https://youtube.com/watch?v=VIDEO_ID"  # grab video
```

- **`yt3`** for audio, **`yt4`** for video, **`lyt`** for the full CLI
- Pick quality by name — `-q 1080p`, `-q 4k`, `-q best` — no memorizing format codes
- Download multiple links in parallel with `--jobs`
- Auto-installs `yt-dlp` and `ffmpeg` on first use — no manual setup
- **Zero typing**: `--paste` grabs links straight from your clipboard, `--watch`
  keeps downloading every link you copy until you stop it
- **Clips**: `--clip 1:10-2:45` downloads just a slice of a long video
- **Download history** with instant dedupe — never grab the same video twice
- `--split-chapters` turns an album/mix video into per-track files
- `--normalize` evens out loudness (EBU R128) while converting
- Profiles (`--profile music|podcast|voice`) and persistent defaults (`lyt config`)
- `lyt doctor` diagnoses your setup, auto-installs missing tools, self-updates yt-dlp
- Interactive mode if you'd rather be prompted than remember flags
- Zero runtime npm dependencies. Small on purpose.

```sh
npm install -g @tanattv/lyt
```

> **Note:** Only download content you own or have permission to use.
> Downloading from YouTube may violate their Terms of Service depending on how
> you use it. You are responsible for your own use of this tool.

---

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer

That's it. `lyt` fetches [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) and
[`ffmpeg`](https://ffmpeg.org/) automatically the first time it needs them — no
manual setup required.

| OS | Where they're cached |
| --- | --- |
| Windows | `%LOCALAPPDATA%\lyt\bin` |
| macOS | `~/Library/Application Support/lyt/bin` |
| Linux | `~/.local/share/lyt/bin` |

yt-dlp downloads are verified against the project's published checksums. A
system-wide install always takes priority — if you already have these tools on
`PATH`, those are used instead.

### Prefer to install them yourself?

Pass `--no-download` (or set `LYT_NO_DOWNLOAD=1`) to require them on `PATH`:

| Platform | Command |
| --- | --- |
| Windows | `winget install yt-dlp.yt-dlp` and `winget install Gyan.FFmpeg` |
| macOS | `brew install yt-dlp ffmpeg` |
| Linux | `sudo apt install ffmpeg` and install yt-dlp from its docs |

On Windows, lyt also tries common WinGet-installed `yt-dlp.exe` and
`C:\ffmpeg\bin\ffmpeg.exe` locations if your current shell has not picked up
PATH changes yet.

## Install

### From npm (recommended)

```bash
npm install -g @tanattv/lyt
```

This puts three commands on your PATH — `lyt`, `yt3`, and `yt4` — usable in
PowerShell, cmd, bash, or zsh. Update later with:

```bash
npm update -g @tanattv/lyt
```

### From GitHub (no npm account needed)

```bash
npm install -g github:tanattv/lyt
```

Re-run the same command to update.

### From source

```bash
git clone https://github.com/tanattv/lyt.git
cd lyt
npm install -g .
```

### Easy install (less terminal)

Helper scripts in [`install/`](install/) wrap the steps above.

**Windows:**

```powershell
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

The Windows installer doesn't just warn about missing tools — it installs
them: `winget` first, falling back to lyt's managed download (per-user, no
admin rights, checksum-verified yt-dlp) and adding the tools dir to your user
`PATH`. It refreshes `PATH` in the current session and ends by printing the
installed versions of node, yt-dlp, and ffmpeg. Safe to re-run any time.

Then, optionally, add right-click menu entries so anyone can download without
touching a terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
```

**Copy a YouTube link → right-click inside a folder → Download audio here.**
Copy several links at once and it grabs them all. Remove the entries later with
the same script and `-Remove`. No administrator rights needed.

**macOS / Linux:**

```bash
bash install/install.sh
```

The shell installer auto-installs missing tools too: `brew`, `apt`, `dnf`, or
`pacman` when available, with lyt's managed binary download as the yt-dlp
fallback. It also verifies and prints installed versions at the end.

## Quick Start

```bash
# Audio (native format, fastest)
yt3 "https://www.youtube.com/watch?v=VIDEO_ID"

# Audio as MP3
yt3 --mp3 "https://www.youtube.com/watch?v=VIDEO_ID"

# Video at 1080p
yt4 -q 1080p "https://www.youtube.com/watch?v=VIDEO_ID"

# Save somewhere specific
yt3 --mp3 -o "$HOME/Music" "https://www.youtube.com/watch?v=VIDEO_ID"

# Download whatever YouTube links are on your clipboard — zero typing
yt3 --paste

# Grab just one section of a long video
yt3 --clip 1:10-2:45 "https://www.youtube.com/watch?v=VIDEO_ID"

# Preview the exact yt-dlp command without downloading
yt4 --dry-run "https://www.youtube.com/watch?v=VIDEO_ID"
```

## Multiple Downloads

Pass as many URLs as you like to `yt3` or `yt4`, and use `--jobs` to download
them in parallel:

```bash
yt3 "URL_1" "URL_2" "URL_3"
yt4 --jobs 3 -q 1080p "URL_1" "URL_2" "URL_3"
```

When several downloads run at once in a terminal, lyt shows one tidy progress
bar per download instead of letting yt-dlp's output interleave. In a pipe or CI
it falls back to plain per-item status lines.

## Zero-Typing Downloads (clipboard)

Copy a YouTube link anywhere, then:

```bash
yt3 --paste          # downloads every YouTube link currently on the clipboard
```

`--paste` (or `-p`) reads the clipboard with whatever your OS already ships
(PowerShell, `pbpaste`, `wl-paste`/`xclip`/`xsel`), extracts every YouTube
link out of the text — even mixed into a chat message — and dedupes them by
video ID.

Go one step further and leave it running:

```bash
yt3 --watch          # (alias: --queue)
```

Watch mode polls the clipboard and downloads **every YouTube link you copy**
until you press `Ctrl+C`. Copy links from your browser one after another and
they all land in your output folder. Pure Node polling — no extra processes,
no dependencies.

## Clips — download only a section

Need one song from a 3-hour mix? Don't download the whole thing:

```bash
yt3 --clip 1:10-2:45 "URL"            # just 1:10 to 2:45
yt4 --clip 12:00- -q 1080p "URL"      # from 12:00 to the end, as video
yt3 --clip -0:30 "URL"                # the first 30 seconds
yt3 --clip 1:00-2:00 --clip 5:00-6:00 "URL"   # several slices in one run
```

Accepts `mm:ss`, `hh:mm:ss`, or plain seconds (`90-180`). Sections are cut
precisely (`--force-keyframes-at-cuts`), and only the requested ranges are
downloaded — dramatically faster than grabbing the full video.

## Download History & Instant Dedupe

Every successful download is recorded in a tiny JSONL file in your user data
dir. If you ask for a video you already downloaded, lyt skips it instantly —
no network round-trip:

```text
Skipping (already downloaded): https://youtu.be/…  — use --redownload to force
```

```bash
lyt history                 # last 20 downloads
lyt history lo-fi           # search past downloads
lyt history --limit 100     # show more
lyt history --clear         # wipe the history
yt3 --redownload "URL"      # download even if it's in history
yt3 --no-history "URL"      # don't record this run
```

## Split an Album into Tracks

If a video has chapters (albums, mixes, podcasts with timestamps):

```bash
yt3 --mp3 --split-chapters "URL"
```

You get one file per chapter, numbered and named after the chapter title, in a
subfolder named after the video.

## Loudness Normalization

```bash
yt3 --normalize "URL"
```

Applies single-pass EBU R128 loudness normalization (`loudnorm`, -16 LUFS)
during the MP3 conversion, so a playlist of downloads plays at an even volume.
Audio mode only; implies `--mp3`.

## Profiles & Persistent Defaults

Three curated profiles replace flag soup:

```bash
yt3 --profile music "URL"     # best VBR MP3 + embedded metadata & cover art
yt3 --profile podcast "URL"   # 96K MP3, loudness-normalized, metadata
yt3 --profile voice "URL"     # smallest useful files (64K, normalized)
```

Set-and-forget defaults with the `config` subcommand (stored as JSON in your
user data dir):

```bash
lyt config set quality 320K
lyt config set output-dir "D:/Music"
lyt config set profile music       # apply a profile to every run
lyt config list
lyt config unset quality
```

Precedence is sensible: explicit flags beat the profile, which beats your
config file, which beats built-in defaults.

## Doctor

```bash
lyt doctor             # check node/yt-dlp/ffmpeg/clipboard + data locations
lyt doctor --fix       # auto-install whatever is missing
lyt doctor --update    # self-update yt-dlp (yt-dlp -U)
```

Prints exactly what is installed, where it lives (PATH vs managed), and what
to run to fix any problem it finds.

## Choosing Quality

You do not have to memorize resolution numbers. In video mode, `-q` (or
`--quality`) takes friendly names:

```bash
yt4 -q 1080p "URL"     # Full HD
yt4 -q 4k "URL"        # 2160p
yt4 -q 8k "URL"        # 4320p, when the video offers it
yt4 -q best "URL"      # highest available (default)
```

Accepted video values: `144p`, `240p`, `360p`, `480p`, `720p`/`hd`,
`1080p`/`fhd`, `1440p`/`2k`, `2160p`/`4k`, `4320p`/`8k`, plain numbers like
`1080`, and `best`. If a video is not available at the size you ask for, yt-dlp
automatically falls back to the closest lower quality.

In audio mode, `-q` is the MP3 bitrate (`128K`, `192K`, `320K`, or `0` for best
VBR — see the Speed Guide).

### See what a video actually offers

Not sure how high a video goes? List its real qualities:

```bash
yt4 --list-formats "URL"
```

```text
Some Video Title
  video: 2160p (4K), 1440p (2K), 1080p (Full HD), 720p (HD)
  download best with: yt4 -q 2160p -- "URL"
  audio: 160k, 128k, 70k
```

## Interactive Mode

Run with `-i`, or just run a command with no URL in a terminal, and lyt asks
you what you want:

```bash
lyt -i
```

It prompts for the URL(s), audio vs video, quality, output directory, and (for
multiple URLs) the number of parallel jobs. In video mode it can **list the
real available qualities and let you pick one from a numbered menu**. Pressing
Enter through the prompts uses the same defaults as the plain commands.

## Command Reference

```text
lyt [options] <youtube-url> [more-urls...]
yt3 <url>   # audio shortcut
yt4 <url>   # video shortcut

lyt history [query] [--limit <n>] [--clear]
lyt config <set|get|unset|list|path> [key] [value]
lyt doctor [--fix] [--update]
```

| Option | Description |
| --- | --- |
| `--mp3` | Convert extracted audio to MP3 with `ffmpeg`. |
| `--native` | Save the native audio stream when possible. Default for audio. |
| `--video` | Download video (best video+audio, muxed to mp4). Default for `yt4`. |
| `--audio` | Download audio only. Default for `lyt`/`yt3`. |
| `-q, --quality <value>` | Audio: MP3 bitrate (`128K`, `192K`, `320K`, `0`). Video: a resolution like `1080p`, `720p`, `4k`, `8k`, or `best`. |
| `--max-height <value>` | Cap video resolution; alias of `-q` in video mode. |
| `-L, --list-formats` | List the qualities available for each URL, then exit. |
| `--clip <start-end>` | Download only this section (`1:10-2:45`, `90-180`, `1:10-`, `-2:45`). Repeatable. |
| `--split-chapters` | Split into one file per chapter, named by chapter. |
| `--normalize` | Loudness-normalize audio (EBU R128). Implies `--mp3`. Audio mode only. |
| `-p, --paste` | Add the YouTube URL(s) found on the clipboard. |
| `--watch`, `--queue` | Watch the clipboard and download every copied link until Ctrl+C. |
| `--profile <name>` | Apply a preset bundle: `music`, `podcast`, or `voice`. |
| `--redownload` | Download even if the video is already in history. |
| `--no-history` | Skip recording this run in the download history. |
| `-f, --fragments <n>` | Concurrent fragments per download. Default is `8`. |
| `-j, --jobs <n>` | Parallel downloads for multiple URLs. Default is `1`. |
| `-o, --output-dir <dir>` | Output directory. Default is `downloads`. |
| `--template <template>` | Custom `yt-dlp` output template. |
| `--downloader <name>` | External downloader, e.g. `aria2c`. |
| `--downloader-args <args>` | Arguments for the external downloader, e.g. `"-x16 -s16 -k1M"`. |
| `--no-part` | Write directly to the output file instead of a `.part` file. |
| `-i, --interactive` | Prompt for options interactively. |
| `--playlist` | Allow playlist downloads. |
| `--no-playlist` | Download only the single video URL. This is the default. |
| `--embed-metadata` | Embed metadata. May add time. |
| `--embed-thumbnail` | Embed thumbnail. May add time. |
| `--force-overwrite` | Replace existing files. |
| `--no-download` | Don't auto-fetch yt-dlp/ffmpeg; require them on PATH instead. |
| `--print-command` | Print the generated `yt-dlp` commands before running. |
| `--dry-run` | Print the generated commands without running downloads. |
| `-h, --help` | Show help. |
| `-v, --version` | Show version. |

## Speed Guide

### Native audio is fastest

```bash
yt3 "URL"
```

YouTube commonly serves audio as `m4a` or `webm`. Keeping that native format
avoids a conversion step and is usually fastest.

### MP3 quality

```bash
yt3 --mp3 -q 320K "URL"   # constant 320 kbps
yt3 --mp3 -q 0 "URL"      # best VBR: high quality, smaller, fast
```

A numeric `0` selects `ffmpeg`'s best **VBR** (variable bitrate). A value like
`320K` forces a constant bitrate, producing larger files.

### External downloader (aria2c)

`--fragments` only helps segmented (DASH/HLS) streams. For audio served as a
single progressive stream, YouTube's per-connection throttling caps the speed.
Handing the download to `aria2c`, which opens several connections per file, can
give a 2–5x speedup:

```bash
yt3 --downloader aria2c --downloader-args "-x16 -s16 -k1M" "URL"
```

This is opt-in because `aria2c` is a separate install and some hosts reject
large connection counts. If a download becomes unstable, lower `-x`/`-s` or
drop the flag.

### Fragment concurrency

```bash
yt4 --fragments 16 "URL"
```

Higher values can be faster on strong connections, but are not always better.
If downloads become unstable, lower the value.

## Output Naming

The default output template is:

```text
%(title).180B [%(id)s].%(ext)s
```

That keeps filenames readable while including the video ID to avoid collisions.
Use a custom template:

```bash
yt4 --template "%(uploader)s - %(title).120B [%(id)s].%(ext)s" "URL"
```

## Platform Support

| Platform | Audio | Video | MP3 | Auto-installs yt-dlp/ffmpeg |
| --- | :---: | :---: | :---: | :---: |
| Windows 10/11 | ✅ | ✅ | ✅ | ✅ |
| macOS | ✅ | ✅ | ✅ | ✅ |
| Linux | ✅ | ✅ | ✅ | ✅ |

## Updating

```bash
npm update -g @tanattv/lyt                # if installed from npm
npm install -g github:tanattv/lyt         # if installed from GitHub
```

## Troubleshooting

**Start with the doctor** — `lyt doctor` checks your whole setup and tells you
exactly what to run. `lyt doctor --fix` installs anything missing;
`lyt doctor --update` self-updates yt-dlp.

**Downloads are slower than expected** — Try native audio instead of `--mp3`,
avoid `--embed-metadata`/`--embed-thumbnail`, try the `aria2c` downloader, or
adjust `--fragments`.

**PowerShell blocks `npm`** — Use `npm.cmd` instead of `npm`.

**`yt-dlp` or `ffmpeg` errors after auto-install** — Delete the cached binaries
and let lyt re-fetch them:

```bash
# Windows
rmdir /s "%LOCALAPPDATA%\lyt\bin"

# macOS
rm -rf ~/Library/Application\ Support/lyt/bin

# Linux
rm -rf ~/.local/share/lyt/bin
```

**Want to use your own installs instead of the managed ones?** — Pass
`--no-download` or set `LYT_NO_DOWNLOAD=1`.

## Development

```bash
npm test                                   # run the test suite (node:test)
node bin/yt4.js --dry-run -q 4k "URL"     # run without installing globally
```

### Project Structure

```text
bin/lyt.js            CLI entry point (full CLI, audio default)
bin/yt3.js            Audio shortcut command
bin/yt4.js            Video shortcut command
src/cli.js            Runtime command orchestration and subcommands
src/ytDlp.js          Argument parsing and yt-dlp command construction
src/quality.js        Friendly video-quality presets and labels
src/formats.js        Reads available qualities from yt-dlp (-J)
src/interactive.js    Interactive prompt mode (node:readline)
src/progress.js       Progress parsing and multi-bar rendering
src/bootstrap.js      Auto-provisioning of yt-dlp and ffmpeg binaries
src/paths.js          Per-user data dir resolution
src/urls.js           YouTube URL extraction and video-ID parsing
src/clipboard.js      Cross-platform clipboard reading (--paste / --watch)
src/history.js        JSONL download history and dedupe
src/config.js         Profiles and persistent config defaults
src/doctor.js         Environment diagnosis, auto-fix, yt-dlp self-update
install/              Install scripts and Windows right-click menu
test/                 Node test runner coverage
app/                  Tauri desktop app (Rust + webview)
```

## License

[MIT](LICENSE)
