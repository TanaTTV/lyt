---
name: lyt
description: Download audio or video from YouTube and other yt-dlp supported sites using the lyt CLI. Use when the user shares a video URL and asks to download it, save it, extract or convert its audio (MP3), grab the video at a specific quality (e.g. 1080p, 4k), or list the formats/qualities a video offers.
---

# Downloading video/audio with lyt

`lyt` wraps yt-dlp + ffmpeg with a friendly CLI. It auto-installs both tools on
first use, so no manual setup is needed.

## Finding the command

Try these in order and use the first that works:

1. `lyt` already on PATH (check with `command -v lyt`)
2. Inside this repository: `node bin/lyt.js` (aliases: `node bin/yt3.js` for
   audio, `node bin/yt4.js` for video)
3. Anywhere else: install it first with `npm install -g @tanattv/lyt`, then use
   `lyt` / `yt3` / `yt4`

Below, `lyt` means whichever invocation you found.

## Common tasks

Always quote URLs. Files land in `./downloads` unless `-o <dir>` is given.

```sh
# Audio (native format, fastest)
lyt --audio "URL"

# Audio as MP3 (use -q for bitrate: 128K / 192K / 320K / 0 = best VBR)
lyt --mp3 -q 192K "URL"

# Video (muxed to mp4); -q accepts 144p...8k, hd, fhd, 2k, 4k, or best (default)
lyt --video -q 1080p "URL"

# See what qualities a video actually offers (no download)
lyt --list-formats "URL"

# Several URLs at once, in parallel
lyt --video -q 1080p --jobs 3 "URL_1" "URL_2" "URL_3"

# Choose where files go
lyt --mp3 -o ~/Music "URL"
```

Other useful flags: `--playlist` to allow playlist URLs (single video is the
default), `--embed-metadata` / `--embed-thumbnail`, `--force-overwrite`,
`--dry-run` to preview the yt-dlp command without downloading.

## Workflow

1. If the user didn't say audio vs video, infer from context ("song", "music",
   "mp3" → audio; "watch", "clip", a resolution → video). Default to audio for
   music links, video otherwise.
2. Run the command. If a requested quality isn't available, yt-dlp falls back
   to the closest lower one automatically — no need to pre-check. Use
   `--list-formats` only when the user asks what's available.
3. Report the output file path(s). In a remote/web session, send the
   downloaded file to the user (e.g. with the SendUserFile tool) since they
   can't reach the container's filesystem; warn that very large videos may be
   impractical to transfer.
4. First run may take longer while lyt fetches yt-dlp/ffmpeg into its cache.
   If the environment forbids downloads, retry with `--no-download` only when
   yt-dlp and ffmpeg are already on PATH.

## Caveats

- Only download content the user owns or has permission to use; downloading
  from YouTube may violate its Terms of Service.
- In sandboxed/remote environments a restrictive network policy can block
  YouTube or the yt-dlp/ffmpeg bootstrap downloads. If downloads fail with
  network errors, tell the user the environment's network policy is likely
  blocking it and suggest running locally.
