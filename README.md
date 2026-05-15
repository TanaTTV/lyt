# yt2audio-fast

`yt2audio-fast` is a tiny Node.js CLI for downloading YouTube audio quickly with `yt-dlp` and converting to MP3 with `ffmpeg` when needed.

The main idea is simple: let `yt-dlp` do the hard download work, keep the wrapper small, and avoid slow extras by default.

## What It Does

- Downloads audio only, not video.
- Defaults to native audio for maximum speed.
- Converts to MP3 when you pass `--mp3`.
- Uses concurrent fragments to speed up segmented downloads.
- Supports multiple URLs with parallel workers.
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

## Command Reference

```text
yt2audio [options] <youtube-url> [more-urls...]
```

Options:

| Option | Description |
| --- | --- |
| `--mp3` | Convert extracted audio to MP3 with `ffmpeg`. |
| `--native` | Save native audio stream when possible. This is the default. |
| `-q, --quality <value>` | MP3 quality, such as `128K`, `192K`, `320K`, or `0`. Default is `192K`. |
| `-f, --fragments <n>` | Concurrent fragments per download. Default is `8`. |
| `-j, --jobs <n>` | Parallel downloads for multiple URLs. Default is `1`. |
| `-o, --output-dir <dir>` | Output directory. Default is `downloads`. |
| `--template <template>` | Custom `yt-dlp` output template. |
| `--playlist` | Allow playlist downloads. |
| `--no-playlist` | Download only the single video URL. This is the default. |
| `--embed-metadata` | Embed metadata. This may add time. |
| `--embed-thumbnail` | Embed thumbnail. This may add time. |
| `--force-overwrite` | Replace existing files. |
| `--print-command` | Print generated `yt-dlp` commands before running. |
| `--dry-run` | Print generated commands without running downloads. |
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

This gives the best MP3 quality setting, but it may create larger files and take longer to convert.

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
bin/yt2audio.js      CLI entry point
src/cli.js           Runtime command orchestration
src/ytDlp.js         Argument parsing and yt-dlp command construction
test/ytDlp.test.js   Node test runner coverage
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
