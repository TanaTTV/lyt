---
name: lyt
description: Download permitted audio or video from YouTube and other yt-dlp-supported sites with the lyt CLI. Use for media downloads, MP3 extraction, quality selection, clips, format inspection, and exact local output paths.
---

# Use lyt for local media

`lyt` is a local CLI around yt-dlp and ffmpeg. Only download media the user
owns or has permission to use.

## Find or install the command

1. Try `lyt --version`.
2. In the lyt repository, use `node bin/lyt.js`.
3. Otherwise install it with `npm install -g @tanattv/lyt`.

Always quote URLs. Prefer `--json` for agent calls: it emits one JSON document
on stdout using schema `lyt.result.v1`, including success state and absolute
final file paths. Diagnostics go to stderr.

```sh
lyt --audio --json "URL"
lyt --mp3 -q 192K --json "URL"
lyt --video -q 1080p --json "URL"
lyt --video --max-filesize 2G --json "URL"
lyt --clip 1:10-2:45 --mp3 --json "URL"
lyt --list-formats --json "URL"
```

Files go to `./downloads` unless `-o <directory>` is supplied. Playlist
downloads are disabled unless the user explicitly requests `--playlist`.
Existing files are not overwritten unless the user requests
`--force-overwrite`. Use `--dry-run --json` when the user wants a preview.

After a successful call, read `results[].files` and report those exact paths.
If `results[].status` is `skipped`, explain the history dedupe and use
`--redownload` only if the user asks to download it again.
