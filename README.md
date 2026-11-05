<p align="center">
  <img src="https://raw.githubusercontent.com/TanaTTV/lyt/main/app/src-tauri/icons/icon.png" width="112" alt="lyt logo: a red Y whose two paths merge into one download arrow" />
</p>

<h1 align="center">lyt</h1>

<p align="center">
  <strong>yt-dlp for AI agents.</strong><br />
  A free, local-first CLI and skill that lets Claude Code, Codex, and any terminal agent<br />
  save permitted audio and video, and get the exact file path back as JSON.
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
> Download media when ownership, permission, a license, public domain status, or
> an applicable copyright exception allows it. Download and reuse rights differ;
> public availability alone does not establish either. Respect applicable site terms.

## Why lyt

| Friendly for people | Reliable for automation | Local by default |
| --- | --- | --- |
| One command: `lyt` | Stable `lyt.result.v1` JSON | Files, config, and history stay on your machine |
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
| copy a link, then download | `lyt` (interactive terminal reads the clipboard) |
| save native audio quickly | `lyt "URL"` |
| create an MP3 | `lyt --mp3 -q 192K "URL"` |
| save a 1080p video | `lyt --video -q 1080p "URL"` |
| choose a folder | `lyt --mp3 -o "D:/Music" "URL"` |
| preview without installing or downloading | `lyt --video -q 1080p --dry-run "URL"` |
| use interactive prompts | `lyt --interactive` |
| inspect available qualities | `lyt --list-formats "URL"` |
| inspect media without downloading or provisioning tools | `lyt info --no-download --json "URL"` |
| list CLI surface for agents | `lyt capabilities --json` |
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

Codex direct skills install to `~/.agents/skills/lyt/SKILL.md`; Claude Code
skills install to `~/.claude/skills/lyt/SKILL.md`. Run the installer again after
upgrading from 0.8.0. The installer does not delete older or custom skill copies.
If an older `~/.codex/skills/lyt` copy is still loaded by your agent, compare it
with the packaged skill and remove only the obsolete copy yourself.

Task guides: [Codex audio](https://tanattv.github.io/lyt/codex-audio/),
[Claude Code video](https://tanattv.github.io/lyt/claude-video/), and
[agent clips](https://tanattv.github.io/lyt/agent-clips/).

### MCP server

`lyt mcp` runs lyt as a [Model Context Protocol](https://modelcontextprotocol.io)
server over stdio, for clients that prefer tools to a shell. It exposes
`lyt_search`, `lyt_info`, `lyt_transcript`, `lyt_download`, and `lyt_doctor`;
each runs the CLI with `--json`, so results use the same schemas.

```json
{ "mcpServers": { "lyt": { "command": "lyt", "args": ["mcp"] } } }
```

### When something fails

Every failed result carries `error.kind` (such as `bot_check`, `rate_limited`,
`tool_outdated`, `format_unavailable`, `members_only`), `error.retryable`, a
one-line `error.suggestion`, and a short `error.diagnostic` tail of the tool
output. `lyt capabilities --json` lists every kind. When lyt manages its own
yt-dlp, it refreshes the copy once it is a week old and retries once with a
fresh copy after an outdated-tool or bot-check failure. Turn that off with
`lyt config set yt-dlp-auto-update false` or `LYT_NO_YT_DLP_UPDATE=1`;
`lyt config set yt-dlp-channel nightly` follows yt-dlp's nightly builds.

### Inspect before you download

Agents can look before they leap. `lyt info` returns media metadata and
available formats as JSON without downloading media, and `lyt capabilities`
returns a self-describing manifest of commands, modes, flags, and result
schemas so a tool-calling agent can discover the surface without scraping help
text:

```sh
lyt info --no-download --json "URL" # lyt.info.v1: title, duration, uploader, formats
lyt capabilities --json        # lyt.capabilities.v1: commands, flags, schemas
```

For faster agent workflows, discover capabilities once per session and use
`doctor` during setup or after a dependency failure. Inspect only when metadata
helps resolve the URL or choose a format; an authorized download with explicit
URL and format can run directly. Batch related URLs:

```sh
lyt info --no-download --json --jobs 3 "URL_1" "URL_2" "URL_3"
lyt --audio --json --jobs 3 "URL_1" "URL_2" "URL_3"
```

Inspection defaults to three workers, accepts `--jobs 1-16`, and retains input
order and per-URL errors. `--jobs 1` makes inspection sequential. Metadata
requests have a 60-second deadline and a 16 MiB combined-output limit per URL.
Matching artifact history returns existing paths before tool setup; missing
files and changed output variants still use normal preparation.

Metadata inspection contacts the media host. Use `--no-download` to prevent
managed tool provisioning during inspection; otherwise a missing yt-dlp binary
can be downloaded automatically. Reuse setup authorization already given, or
ask once if setup is needed and has not been authorized.

For bounded machine-readable jobs, add `--json`:

```sh
lyt --mp3 -q 192K --max-filesize 2G --json "URL"
```

```json
{
  "schema": "lyt.result.v1",
  "version": "0.9.0",
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
- Media metadata schema: [`schemas/lyt.info.v1.schema.json`](schemas/lyt.info.v1.schema.json)
- Capabilities schema: [`schemas/lyt.capabilities.v1.schema.json`](schemas/lyt.capabilities.v1.schema.json)
- `lyt info` reports what a URL offers; `lyt doctor` reports what the local environment can do
- Marketplace package: [`plugins/lyt`](plugins/lyt)
- Demo kit: [`demos/agent-to-file`](demos/agent-to-file)

Global installation, managed tool downloads, playlist mode, overwrites,
authentication material, and external downloaders require explicit opt-in.
Agents should reuse authorization already given instead of asking again.

The maintained skill assesses requests in context, including licenses, public
domain, and applicable copyright exceptions. It adds no blanket license statement
requirement for ordinary local downloads; rights questions depend on governing
policies and concrete context. Local retrieval and publication clearance are
separate. Fair use is case-specific; a short clip, credit, or personal use alone
does not establish it. These instructions do not override provider policies.

After updating your CLI, refresh installed direct skills with `lyt agent install
all` (or `codex` / `claude`). In a source checkout, use `node bin/lyt.js agent
install all` to install the checkout's skill. Start a new agent session to load
the updated instructions. For marketplace installations, see the
[plugin update instructions](plugins/lyt/README.md#update).

## Safe by default

- Playlist URLs download one item unless `--playlist` is present. Links that
  are only a collection (a YouTube playlist or channel, a SoundCloud set or
  profile, a Bandcamp album) are refused without `--playlist` instead of
  silently downloading everything.
- Browser cookies are used only when you pass `--cookies-from-browser` or
  `--cookies`.
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
lyt             # interactive terminal: use a media link already on the clipboard
lyt --paste     # always read the clipboard (scripts / non-TTY too)
lyt --watch     # watch for newly copied links until Ctrl+C
```

Clipboard paste and watch mode pick up YouTube, Spotify, SoundCloud, Vimeo,
and Bandcamp links. Stopping watch mode mid-download keeps the partial file so
the next run resumes it.

### SoundCloud, Vimeo, Bandcamp, and other sites

```sh
lyt "https://soundcloud.com/artist/track"
lyt --playlist "https://soundcloud.com/artist/sets/album"   # → downloads/<set>/001 - ...
lyt --video "https://vimeo.com/123456"
```

Anything yt-dlp supports works. History recognizes repeat downloads from every
site, not just YouTube. With `--playlist`, collections save into their own
folder, numbered in playlist order.

### Many links at once

```sh
lyt -a links.txt            # one URL per line; blank lines and # comments ignored
cat links.txt | lyt -a -    # read from standard input
lyt -j 4 -a links.txt       # four downloads at a time
```

Runs with several items end with a summary such as `Done: 12 saved · 3 skipped`.

### Subtitles and sponsor segments

```sh
lyt --video --subs "URL"                      # English .srt next to the video
lyt --video --embed-subs --sub-langs en,de "URL"
lyt --sponsorblock "URL"                      # cut sponsor/self-promo segments
```

If subtitles cannot be downloaded (for example a rate limit), the media is
still saved and the result carries a warning.

### Slow or flaky connections

```sh
lyt --limit-rate 2M --retries 20 "URL"
```

### Media your account can access

```sh
lyt --cookies-from-browser firefox "URL"
```

Uses your own browser session for age-restricted or members-only media you are
allowed to watch. lyt never reads cookies unless you pass this flag.

### Grab part of a video

```sh
lyt --mp3 --clip 1:10-2:45 "URL"
lyt --video --clip 12:00- -q 1080p "URL"
```

Ranges accept seconds, `mm:ss`, or `hh:mm:ss`. Repeat `--clip` to save
multiple sections.

### Video and audio for editing

```sh
lyt --editor "URL"                                   # H.264 + AAC MP4 editors import as-is
lyt --editor --clip 1:10-1:40 --name broll "URL"     # a named, editor-ready slice
lyt --profile edit "URL"                             # the same as --editor
lyt --audio-format wav "URL"                         # also m4a, opus, flac, mp3
lyt --video --container mkv "URL"                    # mkv or mov instead of mp4
lyt --thumbnail --info-json "URL"                    # .jpg thumbnail and .info.json alongside
```

YouTube's top qualities are often VP9 or AV1, which Premiere, Final Cut, and
some versions of Resolve and CapCut cannot import without converting.
`--editor` prefers H.264 instead, which on YouTube usually means 1080p.

### Transcripts

```sh
lyt transcript "URL"                  # captions as plain text
lyt transcript --timestamps "URL"     # [m:ss] before each line, for picking --clip times
lyt transcript --lang es --json "URL" # lyt.transcript.v1 with segments and chapters
```

Only the caption file is downloaded. Manual subtitles are used when present,
otherwise automatic captions; the JSON says which (`automatic`).

### Chapters and normalized audio

```sh
lyt --chapter "Q&A" "URL"             # only chapters whose title contains the text
lyt --mp3 --split-chapters "URL"
lyt --normalize "URL"
```

`--normalize` uses ffmpeg's EBU R128 loudness filter and implies MP3.

### Ready-made profiles

```sh
lyt --profile music "URL"     # high-quality MP3 + metadata + cover art
lyt --profile podcast "URL"   # compact normalized MP3 + metadata
lyt --profile voice "URL"     # small normalized speech file
lyt --profile edit "URL"      # H.264 + AAC MP4 for video editors
```

### Big playlists and channels

```sh
lyt --playlist --max-items 10 "URL"                     # the first 10 entries
lyt --playlist --items 1-5,8 "URL"                      # chosen positions
lyt --playlist --after today-30days "URL"               # uploaded in the last 30 days
lyt --playlist --min-duration 60 --max-duration 20:00 "URL"
lyt --playlist --polite "URL"                           # pause between requests
lyt --wait "URL"                                        # wait for a premiere to start
```

### Spotify playlists, albums, tracks, and artists

```sh
lyt "https://open.spotify.com/playlist/PLAYLIST_ID"
lyt "https://open.spotify.com/album/ALBUM_ID"
lyt "https://open.spotify.com/artist/ARTIST_ID"      # the artist's top tracks
lyt --sync "https://open.spotify.com/playlist/PLAYLIST_ID"
lyt info "https://open.spotify.com/playlist/PLAYLIST_ID"   # list the songs only
```

Spotify audio is DRM-protected, so lyt never downloads from Spotify. It reads
the public track list and finds each song on YouTube:

- **Matching:** lyt checks the top five results for `Artist - Title` and takes
  the first whose length is within a few seconds of the Spotify track, which
  skips music videos with intros and extended mixes. If none fit, it takes the
  top result. `--json` reports the matched video for each song (`match`).
- **Files:** MP3s are saved as `downloads/<playlist>/NN - Artist - Title.mp3` in
  Spotify order, tagged with the Spotify artist, title, album, and track
  number, with the album cover embedded. A `<playlist>.m3u8` file lists the
  songs in order for music players.
- **Re-runs:** songs already on disk are skipped (reported as `skipped` /
  `exists` in `--json`), even if the playlist order changed. `--sync`
  renumbers saved songs to the current order and moves songs that left the
  playlist into a `removed` folder.
- **Speed:** three songs download at a time unless you set `-j`.
- **Large playlists:** Spotify's public page lists only the first 100 songs of
  a playlist. For the full list, create a free app at
  <https://developer.spotify.com/dashboard> and save its keys:

  ```sh
  lyt config set spotify-client-id YOUR_CLIENT_ID
  lyt config set spotify-client-secret YOUR_CLIENT_SECRET
  ```

  (or set `LYT_SPOTIFY_CLIENT_ID` / `LYT_SPOTIFY_CLIENT_SECRET`). The secret is
  never printed by `lyt config`. If Spotify's API refuses a playlist, lyt falls
  back to the public list and says so.

Only public links work.

## History, configuration, and diagnostics

```sh
# Find, search, or clear previous downloads
lyt history
lyt history podcast --limit 50
lyt history --limit 50 --json
lyt history --clear
lyt last                  # paths of the newest download
lyt last --reveal         # show it in its folder (--open opens it)

# Save defaults
lyt config set output-dir "D:/Music"
lyt config set profile music
lyt config set video true          # plain `lyt` downloads video (yt3 stays audio)
lyt config set max-height 1080p
lyt config set subs true
lyt config list
lyt config unset profile

# Keys: output-dir, quality, template, fragments, jobs, profile, mp3,
# embed-metadata, embed-thumbnail, normalize, downloader, downloader-args,
# video, max-height, max-filesize, playlist, history, subs, sub-langs,
# embed-subs, sponsorblock, limit-rate, retries, cookies-from-browser,
# audio-format, container, editor, thumbnail, polite, update-check,
# yt-dlp-auto-update, yt-dlp-channel, spotify-client-id, spotify-client-secret.
# Invalid values are rejected when you set them.

# Check or repair tools
lyt doctor
lyt doctor --json
lyt doctor --fix
lyt doctor --update       # explicitly update yt-dlp (lyt update does the same)
lyt doctor --check-updates # refresh lyt release information without installing
lyt doctor --network      # can this machine reach YouTube, Spotify, SoundCloud, GitHub?

# Tab completion
lyt completion bash >> ~/.bashrc   # also zsh, fish

# Optional: disable “update available” notices
lyt config set update-check false
# or: LYT_NO_UPDATE_CHECK=1
```

Human downloads, `lyt doctor`, and `lyt --version` can notice when a newer lyt
is on npm. Successful checks are cached for six hours; a changed installed lyt
version refreshes the cache. Offline failures back off for five minutes, and
cached notices clearly identify stale information. Use `lyt doctor --check-updates`
(or add `--json`) to bypass the cache and failure backoff. The existing
`update-check` setting and environment opt-outs still apply.

Checks use npm's published `latest` version, never an unpublished GitHub branch.
Human download checks run alongside the job; JSON downloads and inspections do
not check npm or print upgrade notices. `doctor --json` can report release status
inside its normal JSON document. lyt does not install its own updates; follow
the printed npm command when ready. `doctor --update` explicitly updates yt-dlp,
which is separate from updating lyt or ffmpeg.

A malformed config is moved aside with a `.corrupt-<timestamp>` suffix instead
of being ignored silently. Config writes use a complete temporary file before
replacement.

Command flags override profiles, profiles override the `yt3` / `yt4` aliases,
the aliases override saved configuration, and saved configuration overrides
built-in defaults.

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

lyt info <url> [more-urls...] [--json]
lyt inspect <url> [more-urls...] [--json]   # alias of info
lyt search "query" [--limit 1-25] [--json]
lyt transcript <url> [--lang en] [--timestamps] [--json]
lyt last [query] [--open|--reveal] [--json]
lyt update
lyt mcp
lyt completion <bash|zsh|fish>
lyt capabilities [--json]
lyt history [query] [--limit <n>] [--clear] [--json]
lyt config <set|get|unset|list|path> [key] [value]
lyt doctor [--fix] [--update] [--check-updates] [--network] [--json]
lyt agent install [codex|claude|all] [--home <dir>]
```

### Aliases

`yt3` and `yt4` remain installed for compatibility. They are optional shortcuts,
not a second product surface:

| Alias | Equivalent |
| --- | --- |
| `yt3 "URL"` | `lyt "URL"` (native audio defaults) |
| `yt4 "URL"` | `lyt --video "URL"` (video defaults) |

Everything else — flags, subcommands, config, history, and JSON — is the same
`lyt` interface.

<details>
<summary><strong>Show every CLI option</strong></summary>

| Option | Purpose |
| --- | --- |
| `--audio`, `--video` | Select audio or video mode. |
| `--mp3`, `--native` | Convert to MP3 or preserve native audio. |
| `--audio-format <fmt>` | Audio output: `native`, `mp3`, `m4a`, `opus`, `wav`, or `flac`. |
| `--editor`, `--h264` | Video for editing: prefer H.264 + AAC in MP4. |
| `--container <fmt>` | Video container: `mp4`, `mkv`, or `mov`. |
| `-n, --name <name>` | Output file name without extension (one URL). |
| `--chapter <text>` | Keep only chapters whose title contains the text; repeatable. |
| `--thumbnail`, `--info-json` | Save the thumbnail or `.info.json` next to the media. |
| `--items <list>`, `--max-items <n>` | Choose playlist positions or stop after n entries. |
| `--after <date>`, `--before <date>` | Filter by upload date. |
| `--min-duration <t>`, `--max-duration <t>` | Filter by length. |
| `--wait` | Wait for a premiere or scheduled stream. |
| `--polite` | Pause between requests on large jobs. |
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
| `--profile <name>` | Use `music`, `podcast`, `voice`, or `edit`. |
| `--playlist`, `--no-playlist` | Allow playlists, channels, sets, and profiles, or force a single item. |
| `-a, --batch-file <file>` | Read URLs from a file, one per line (`-` for stdin). |
| `--subs`, `--sub-langs <langs>`, `--embed-subs`, `--no-subs` | Save or embed subtitles. |
| `--sponsorblock`, `--no-sponsorblock` | Cut sponsor, self-promo, and interaction segments. |
| `--cookies-from-browser <browser>`, `--cookies <file>` | Use your own login for media you can access. |
| `-r, --limit-rate <rate>` | Cap download speed. |
| `--retries <n>` | Retries for downloads and fragments. |
| `--sync` | Spotify: renumber saved songs and move removed ones aside. |
| `--history` | Record history even if config turned it off. |
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
| Your editor won't import the video | Download with `--editor` (H.264 + AAC MP4). |
| "Sign in to confirm you're not a bot" | Run `lyt update`, wait, and retry; see the [help page](https://tanattv.github.io/lyt/help/). |

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
