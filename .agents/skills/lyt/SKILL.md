---
name: lyt
description: Inspect, plan, search, or download permitted audio and video with the lyt CLI. Use for metadata review, captions, local artifact receipts, MP3 extraction, quality selection, clips, and exact local output paths.
---

# Use lyt for local media

`lyt` is a local CLI around yt-dlp and ffmpeg. Only download media the user owns
or has permission to use. A public URL does not automatically grant permission.

## Find or install the command

1. Try `lyt --version`.
2. In the lyt repository, use `node bin/lyt.js`.
3. Otherwise ask before globally installing `@tanattv/lyt`.

Global npm installation and first-use managed binary downloads are side effects.
Do not perform either without explicit user approval. Check capabilities with:

```sh
lyt doctor --json
```

Always quote URLs. Prefer `--dry-run --json` before a large or uncertain job.
For bounded agent calls, `--json` emits one JSON document using schema `lyt.result.v1` on stdout; setup and progress diagnostics go to stderr.

```sh
lyt --audio --dry-run --json "URL"
lyt --audio --json "URL"
lyt --mp3 -q 192K --json "URL"
lyt --video -q 1080p --max-filesize 2G --json "URL"
lyt --clip 1:10-2:45 --mp3 --json "URL"
lyt --list-formats --json "URL"
```

Prefer read-only discovery before a real or uncertain download:

```sh
lyt inspect --json "URL"
lyt plan --video -q 1080p --json "URL"
lyt search --limit 10 --json "query"
```

`inspect`, `plan`, and `search` read metadata but do not download media.
`search` results are never an implicit download request.

Captions stay explicit and source-specific:

```sh
lyt --subs en,es --json "URL"       # publisher-provided tracks
lyt --auto-subs en --json "URL"     # generated captions
```

Do not combine manual and generated caption modes, and do not describe either
as transcription.

For local integrity receipts:

```sh
lyt receipt --sha256 "FILE"
lyt verify "FILE.lyt-receipt.json"
```

Verification covers the local file only. It does not prove remote authenticity,
ownership, or permission.

Files go to `./downloads` under the current working directory unless `-o` is
supplied. Before a real job, confirm the intended output directory when it is
material to the user's workflow.

Keep these behaviors opt-in:

- `--playlist`
- `--force-overwrite`
- `--redownload`
- browser cookies or authentication material
- external downloaders
- managed tool installation

Never use cookies, tokens, private URLs, or authentication material unless the
user explicitly requests it. Never include those values in logs or bug reports.

After success, read `results[].files` and report those exact paths. If a result
is skipped, explain whether a matching artifact already exists or a size guard
was triggered. Use `--redownload` only when the user asks for another copy.

For an integration that needs live progress, use
`--events-jsonl --job-id <id>` and parse one `lyt.job-event.v1` document per
stdout line. Event jobs accept exactly one URL. Treat `completed`, `failed`,
and `canceled` as terminal states.
