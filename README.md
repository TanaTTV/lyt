# ytgrab

**ytgrab** is a tiny, fast, friendly command-line tool for downloading YouTube
audio and video. It wraps [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) and
[`ffmpeg`](https://ffmpeg.org/) and stays out of the way: sensible defaults,
short commands, and quality you can pick by name instead of memorizing numbers.

```bash
yt3 "https://www.youtube.com/watch?v=VIDEO_ID"      # audio
yt4 -q 1080p "https://www.youtube.com/watch?v=VIDEO_ID"  # video
```

- **`yt3`** grabs audio, **`yt4`** grabs video, **`ytgrab`** is the full CLI.
- Friendly quality: `-q 1080p`, `-q 4k`, `-q 8k`, `-q best`, or list what a
  video actually offers with `--list-formats`.
- Download many links at once, in parallel, with a clean progress display.
- Interactive mode for when you would rather be asked than remember flags.
- Zero runtime dependencies. The wrapper is small on purpose.

## Important Usage Note

Only download content you own, have permission to download, or are otherwise
allowed to use. Downloading from YouTube may violate YouTube's Terms of Service
depending on the content and how you use it. You are responsible for how you use
this tool.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp#installation)
- [`ffmpeg`](https://ffmpeg.org/) — required for MP3 conversion and for muxing
  video+audio into a single file

### Installing yt-dlp and ffmpeg

| Platform | Command |
| --- | --- |
| Windows | `winget install yt-dlp.yt-dlp` and `winget install Gyan.FFmpeg` |
| macOS | `brew install yt-dlp ffmpeg` |
| Linux | Use your distro's package manager (e.g. `apt install ffmpeg`) and install `yt-dlp` from its docs. |

On Windows, ytgrab also tries common WinGet-installed `yt-dlp.exe` and
`C:\ffmpeg\bin\ffmpeg.exe` locations if your current shell has not picked up PATH
changes yet.

## Install

### From npm (recommended)

```bash
npm install -g @tanattv/ytgrab
```

This puts three commands on your PATH — `ytgrab`, `yt3`, and `yt4` — usable in
PowerShell, cmd, bash, or zsh. Update later with:

```bash
npm update -g @tanattv/ytgrab
```

### From GitHub (no npm account needed)

```bash
npm install -g github:TanaTTV/yt2audio-fast
```

Re-run the same command to update.

### From source

```bash
git clone https://github.com/TanaTTV/yt2audio-fast.git
cd yt2audio-fast
npm install -g .
```

### Easy install (less terminal)

Helper scripts in [`install/`](install/) wrap the steps above.

**Windows:**

```powershell
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

Then, optionally, add right-click menu entries so a non-technical user never
touches a terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
```

Now anyone can **copy a YouTube link**, **right-click inside a folder**, and
choose **Download audio here** or **Download video here**. Copy several links at
once and it grabs them all. Remove the entries later with the same script and
`-Remove`. It only touches your own user settings, so it needs no administrator
rights.

**macOS / Linux:**

```bash
bash install/install.sh
```

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

When several downloads run at once in a terminal, ytgrab shows one tidy progress
bar per download instead of letting yt-dlp's output interleave. In a pipe or CI
it falls back to plain per-item status lines.

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

Run with `-i`, or just run a command with no URL in a terminal, and ytgrab asks
you what you want:

```bash
ytgrab -i
```

It prompts for the URL(s), audio vs video, quality, output directory, and (for
multiple URLs) the number of parallel jobs. In video mode it can **list the
real available qualities and let you pick one from a numbered menu**. Pressing
Enter through the prompts uses the same defaults as the plain commands.

## Command Reference

```text
ytgrab [options] <youtube-url> [more-urls...]
yt3 <url>   # audio shortcut
yt4 <url>   # video shortcut
```

| Option | Description |
| --- | --- |
| `--mp3` | Convert extracted audio to MP3 with `ffmpeg`. |
| `--native` | Save the native audio stream when possible. Default for audio. |
| `--video` | Download video (best video+audio, muxed to mp4). Default for `yt4`. |
| `--audio` | Download audio only. Default for `ytgrab`/`yt3`. |
| `-q, --quality <value>` | Audio: MP3 bitrate (`128K`, `192K`, `320K`, `0`). Video: a resolution like `1080p`, `720p`, `4k`, `8k`, or `best`. |
| `--max-height <value>` | Cap video resolution; alias of `-q` in video mode. |
| `-L, --list-formats` | List the qualities available for each URL, then exit. |
| `-f, --fragments <n>` | Concurrent fragments per download. Default is `8`. |
| `-j, --jobs <n>` | Parallel downloads for multiple URLs. Default is `1`. |
| `-o, --output-dir <dir>` | Output directory. Default is `downloads`. |
| `--template <template>` | Custom `yt-dlp` output template. |
| `--downloader <name>` | External downloader to hand files to, e.g. `aria2c`. |
| `--downloader-args <args>` | Arguments for the external downloader, e.g. `"-x16 -s16 -k1M"`. |
| `--no-part` | Write directly to the output file instead of a `.part` file. |
| `-i, --interactive` | Prompt for options interactively. |
| `--playlist` | Allow playlist downloads. |
| `--no-playlist` | Download only the single video URL. This is the default. |
| `--embed-metadata` | Embed metadata. May add time. |
| `--embed-thumbnail` | Embed thumbnail. May add time. |
| `--force-overwrite` | Replace existing files. |
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
large connection counts. If a download becomes unstable, lower `-x`/`-s` or drop
the flag.

### Fragment concurrency

```bash
yt4 --fragments 16 "URL"
```

Higher values can be faster on strong connections, but are not always better. If
downloads become unstable, lower the value.

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

## Updating

```bash
npm update -g @tanattv/ytgrab        # if installed from npm
npm install -g github:TanaTTV/yt2audio-fast   # if installed from GitHub
```

## Troubleshooting

**`yt-dlp was not found on PATH`** — Install it and open a new terminal:

```bash
winget install yt-dlp.yt-dlp   # Windows
brew install yt-dlp            # macOS
```

**`ffmpeg was not found on PATH`** — Required for `--mp3` and for video. Install
it, then verify with `ffmpeg -version`.

**Downloads are slower than expected** — Try native audio instead of `--mp3`,
avoid `--embed-metadata`/`--embed-thumbnail`, try the `aria2c` downloader, or
adjust `--fragments`.

**PowerShell blocks `npm`** — Use `npm.cmd` instead of `npm`.

## Development

```bash
npm test                 # run the test suite (node --test)
node bin/yt4.js --dry-run -q 4k "URL"   # run without installing
```

### Project Structure

```text
bin/ytgrab.js            CLI entry point (full CLI, audio default)
bin/yt3.js               Audio shortcut command
bin/yt4.js               Video shortcut command
src/cli.js               Runtime command orchestration
src/ytDlp.js             Argument parsing and yt-dlp command construction
src/quality.js           Friendly video-quality presets and labels
src/formats.js           Reads available qualities from yt-dlp (-J)
src/interactive.js       Interactive prompt mode (node:readline)
src/progress.js          Progress parsing and aggregated multi-bar rendering
install/                 Install scripts and Windows right-click menu
test/                    Node test runner coverage
```

## License

[MIT](LICENSE)
