# yt2audio-fast

`yt2audio-fast` is a tiny Node.js CLI for downloading YouTube audio quickly with `yt-dlp` and converting to MP3 with `ffmpeg` when needed.

The main idea is simple: let `yt-dlp` do the hard download work, keep the wrapper small, and avoid slow extras by default.

**Copy link → run `yt3` → file appears.** You still need the URL from somewhere (browser, chat, notes), but the download itself stays on your PC — terminal, right-click menu, clipboard watcher, or an AI agent via MCP. No YouTube download UI, no extra browser tabs.

## What It Does

- Downloads audio by default, or video with `--video` (or the `yt4` command).
- Ships short commands: `yt3` for audio, `yt4` for video.
- Defaults to native audio for maximum speed.
- Converts to MP3 when you pass `--mp3`.
- Uses concurrent fragments to speed up segmented downloads.
- Optionally hands downloads to an external downloader such as `aria2c` for big speedups on throttled hosts.
- Supports multiple URLs with parallel workers and a clean aggregated progress display.
- Offers an interactive prompt mode (`-i`, or just run it with no URL in a terminal).
- Avoids metadata and thumbnail embedding unless you explicitly request them.
- Keeps downloaded audio files out of git with `.gitignore`.

## Important Usage Note

Only download content you own, have permission to download, or are otherwise allowed to use. Downloading from YouTube may violate YouTube's Terms of Service depending on the content and use.

## Requirements

- Node.js 20 or newer
- `yt-dlp`
- `ffmpeg` for MP3 conversion

On Windows, this CLI also tries to find common WinGet-installed `yt-dlp.exe` and `C:\ffmpeg\bin\ffmpeg.exe` locations when the current shell has not picked up PATH changes yet.

## Install Dependencies

### Windows

Install `yt-dlp`:

```powershell
winget install yt-dlp.yt-dlp
```

Install Node.js if needed:

```powershell
winget install OpenJS.NodeJS
```

After installing command-line tools with WinGet, open a new terminal so PATH changes are loaded.

### macOS

```bash
brew install node yt-dlp ffmpeg
```

### Linux

Use your distro package manager for Node.js and `ffmpeg`, then install `yt-dlp` from your package manager or from the official project instructions.

## Install This CLI Locally

From the project folder:

```powershell
npm.cmd install
npm.cmd link
```

After linking, run:

```powershell
yt2audio --version
```

If you do not want to link it globally, run it directly:

```powershell
node .\bin\yt2audio.js --version
```

## Install Globally (use `yt3` / `yt4` anywhere)

From the project folder, install the commands onto your PATH so they work in any
PowerShell, cmd, bash, or zsh window:

```powershell
npm.cmd install -g .
```

(On macOS/Linux: `npm install -g .`)

This adds three commands:

| Command | Does |
| --- | --- |
| `yt3` | Download audio (same as `yt2audio`). |
| `yt4` | Download video (best video+audio, muxed to mp4). |
| `yt2audio` | The full CLI; defaults to audio. |

Then, from anywhere:

```powershell
yt3 "https://www.youtube.com/watch?v=VIDEO_ID"
yt4 "https://www.youtube.com/watch?v=VIDEO_ID"
```

You can pass several URLs at once to either command, and use `--jobs` to fetch
them in parallel:

```powershell
yt3 --jobs 3 "URL_1" "URL_2" "URL_3"
yt4 --max-height 1080 "URL_1" "URL_2"
```

To update after pulling new changes, just run `npm.cmd install -g .` again. To
remove the commands, run `npm.cmd uninstall -g yt2audio-fast`.

## Local-First Integration

Ways to download without opening a browser's save dialog:

| Method | How |
| --- | --- |
| **Terminal** | `yt3 "URL"` or `yt3 -i` for prompts |
| **Right-click** | Windows context menu — copy link, right-click folder, pick **Download audio here** |
| **Clipboard watcher** | `install/clipboard-watcher.ps1` — copy a link, file downloads automatically |
| **Parallel batch** | Paste several URLs: `yt3 --jobs 3 URL1 URL2 URL3` |
| **MCP agent** | `mcp/` server lets Cursor/Claude call `download_audio` (see `mcp/README.md`) |

### Clipboard watcher (Windows)

After installing `yt3` globally:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\clipboard-watcher.ps1
```

Copy any YouTube link (`Ctrl+C`) and the watcher runs `yt3` in the background. Add `-Mp3` for MP3 conversion or `-OutputDir` to choose a folder.

### Windows right-click menu

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
```

Copy a link, right-click inside a folder, choose **Download audio here** or **Download video here**.

## Easy Install (less terminal)

Helper scripts in the `install/` folder wrap the steps above.

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\install\install.ps1
```

This installs `yt3` / `yt4` / `yt2audio` and warns you if `yt-dlp` or `ffmpeg`
is missing.

Then, optionally, add right-click menu entries so you never touch a terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1
```

Now anyone can:

1. Copy a YouTube link (`Ctrl+C`).
2. Right-click inside the folder where they want the file.
3. Choose **Download audio here** or **Download video here**.

The download uses the copied link and saves into that folder. Copy several
links at once and it grabs them all. Remove the entries later with the same
script and `-Remove`. It only touches your own user settings, so it needs no
administrator rights.

### macOS / Linux

```bash
bash install/install.sh
```

## Quick Start

Fastest mode, preserving the native audio format when possible:

```powershell
yt2audio "https://www.youtube.com/watch?v=VIDEO_ID"
```

MP3 mode:

```powershell
yt2audio --mp3 "https://www.youtube.com/watch?v=VIDEO_ID"
```

Save to your Downloads folder:

```powershell
yt2audio --mp3 --output-dir "$env:USERPROFILE\Downloads" "https://www.youtube.com/watch?v=VIDEO_ID"
```

Preview the exact `yt-dlp` command without downloading:

```powershell
yt2audio --dry-run --mp3 "https://www.youtube.com/watch?v=VIDEO_ID"
```

## Interactive Mode

If you would rather be asked than remember flags, run the CLI with `-i`, or simply run it with no URL in a terminal:

```powershell
yt2audio -i
```

It asks for the URL(s), native vs MP3, quality, output directory, and (for multiple URLs) the number of parallel jobs, then runs the download. Defaults match the normal command-line defaults, so pressing Enter through every prompt behaves like a plain `yt2audio <url>`.

When you pass several URLs with `--jobs`, the CLI renders one aggregated progress bar per download instead of letting `yt-dlp`'s parallel output interleave. In a non-interactive context (a pipe or CI), it falls back to plain per-item status lines.

## Command Reference

```text
yt2audio [options] <youtube-url> [more-urls...]
```

Options:

| Option | Description |
| --- | --- |
| `--mp3` | Convert extracted audio to MP3 with `ffmpeg`. |
| `--native` | Save native audio stream when possible. This is the default. |
| `--video` | Download video (best video+audio, muxed to mp4). Default for `yt4`. |
| `--audio` | Download audio only. This is the default for `yt2audio`/`yt3`. |
| `--max-height <n>` | Cap video resolution, e.g. `1080` or `720` (video mode). |
| `-q, --quality <value>` | MP3 quality, such as `128K`, `192K`, `320K`, or `0`. Default is `192K`. |
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
| `--embed-metadata` | Embed metadata. This may add time. |
| `--embed-thumbnail` | Embed thumbnail. This may add time. |
| `--force-overwrite` | Replace existing files. |
| `--print-command` | Print generated `yt-dlp` commands before running. |
| `--dry-run` | Print generated commands without running downloads. |
| `--json` | Emit machine-readable JSON on stdout (for scripts and MCP). |
| `--cookies-from-browser <browser>` | Use browser cookies (`chrome`, `firefox`, `edge`, etc.). |
| `--cookies <file>` | Netscape cookie file for restricted videos. |
| `-h, --help` | Show help. |
| `-v, --version` | Show version. |

## Speed Guide

### Fastest Possible

Use native audio:

```powershell
yt2audio "https://www.youtube.com/watch?v=VIDEO_ID"
```

This avoids conversion entirely. YouTube commonly serves audio as `m4a` or `webm`, and keeping that format is usually faster than converting it.

### Fast MP3

Use the default MP3 quality:

```powershell
yt2audio --mp3 "https://www.youtube.com/watch?v=VIDEO_ID"
```

The CLI downloads the best available audio stream, then asks `ffmpeg` to produce a `192K` MP3.

### Maximum MP3 Quality

Use `--quality 0`:

```powershell
yt2audio --mp3 --quality 0 "https://www.youtube.com/watch?v=VIDEO_ID"
```

A numeric value like `0` selects `ffmpeg`'s best **VBR** (variable bitrate) setting: high quality with a smaller, faster-to-produce file. A value like `320K` forces a constant high bitrate, which makes larger files and can take a little longer. Both are passed straight through to `yt-dlp`'s `--audio-quality`.

### External Downloader (aria2c)

`--concurrent-fragments` only helps segmented (DASH/HLS) streams. For audio served as a single progressive stream, YouTube's per-connection throttling caps the speed. Handing the download to `aria2c`, which opens several connections per file, often gives a 2–5x speedup:

```powershell
yt2audio --downloader aria2c --downloader-args "-x16 -s16 -k1M" "https://www.youtube.com/watch?v=VIDEO_ID"
```

This is opt-in because `aria2c` is a separate install and some hosts reject large connection counts. If a download becomes unstable, lower `-x`/`-s` or drop the flag.

### Multiple URLs

Use jobs to download several URLs at the same time:

```powershell
yt2audio --mp3 --jobs 4 "URL_1" "URL_2" "URL_3" "URL_4"
```

`--jobs` parallelizes separate URLs. It does not split a single video into multiple independent conversions.

### Fragment Concurrency

Increase fragment concurrency for segmented streams:

```powershell
yt2audio --fragments 16 "https://www.youtube.com/watch?v=VIDEO_ID"
```

Higher values can be faster on strong connections, but they are not always better. If downloads become unstable, lower the value.

## Output Naming

The default output template is:

```text
%(title).180B [%(id)s].%(ext)s
```

That keeps filenames readable while including the video ID to avoid collisions.

Use a custom template:

```powershell
yt2audio --template "%(uploader)s - %(title).120B [%(id)s].%(ext)s" "URL"
```

## Examples

Download native audio to the project `downloads` folder:

```powershell
yt2audio "https://youtu.be/Ls1thq--vEg"
```

Download MP3 to your Downloads folder:

```powershell
yt2audio --mp3 --output-dir "$env:USERPROFILE\Downloads" "https://youtu.be/Ls1thq--vEg"
```

Download a playlist:

```powershell
yt2audio --playlist --mp3 "https://www.youtube.com/playlist?list=PLAYLIST_ID"
```

Embed metadata and thumbnail:

```powershell
yt2audio --mp3 --embed-metadata --embed-thumbnail "https://www.youtube.com/watch?v=VIDEO_ID"
```

## Development

Run tests:

```powershell
npm.cmd test
```

Run the CLI without linking:

```powershell
node .\bin\yt2audio.js --dry-run --mp3 "https://www.youtube.com/watch?v=VIDEO_ID"
```

## Project Structure

```text
bin/yt2audio.js          CLI entry point (audio default)
bin/yt3.js               Audio shortcut command
bin/yt4.js               Video shortcut command
src/cli.js               Runtime command orchestration
src/ytDlp.js             Argument parsing and yt-dlp command construction
src/interactive.js       Interactive prompt mode (node:readline)
src/progress.js          Progress parsing and aggregated multi-bar rendering
test/ytDlp.test.js       Argument and command-builder coverage
test/progress.test.js    Progress parser and renderer coverage
test/interactive.test.js Interactive prompt coverage
```

## Troubleshooting

### `yt-dlp was not found on PATH`

Install it and open a new terminal:

```powershell
winget install yt-dlp.yt-dlp
```

Then verify:

```powershell
yt-dlp --version
```

### `ffmpeg was not found on PATH`

Install `ffmpeg`, then verify:

```powershell
ffmpeg -version
```

### PowerShell blocks `npm`

Use `npm.cmd` instead of `npm`:

```powershell
npm.cmd test
```

### Downloads are slower than expected

- Try native mode instead of `--mp3`.
- Avoid `--embed-metadata` and `--embed-thumbnail`.
- Try `--fragments 16` on fast connections.
- Use `--jobs` only when downloading multiple URLs.

## License

MIT
