# Agent search and download results

lyt 0.9.0 adds search, artifact inspection, and actionable failures while keeping
existing commands, numeric exit codes, and `results[].files` available.

## Search

```sh
lyt search "artist song" --limit 5 --no-download --json
```

Search emits `lyt.search.v1`. It only returns candidates; downloading is a
separate command against a selected canonical URL. Queries accept 1-500
characters and limits accept 1-25, defaulting to five. Use `--` before a query
beginning with a dash. Search does not load yt-dlp user configuration, does not
mark media watched, and requests flat metadata without downloading media.
`--no-download` also disables managed tool setup. Requests have bounded output
and a 60-second timeout.

Each candidate includes `index`, `id`, `extractor`, `title`, `uploader`,
`durationSeconds`, `url`, `thumbnail`, `liveStatus`, `isLive`, and `isUpcoming`.
Unknown metadata is nullable; flat search metadata is not full inspection.
An empty result list is successful. Operational failures return `ok: false`
and an error in the search envelope; invalid arguments use the existing
`lyt.result.v1` top-level error envelope. Search's `index` is only a display
position, not a persistent download selector.

## Artifact receipts

Downloads and history skips include `artifacts` alongside the unchanged `files`
array. Each receipt describes the actual final file, after conversion or merging.

```json
{
  "path": "/absolute/output/song.mp3",
  "sizeBytes": 25747,
  "container": "mp3",
  "durationSeconds": 1.018,
  "streams": [{ "type": "audio", "codec": "mp3", "sampleRate": 44100, "channels": 2 }],
  "verification": { "status": "verified", "tool": "ffprobe", "version": "9.0" }
}
```

Every reported artifact must be a nonempty regular file. When an existing
ffprobe is found on an absolute PATH or alongside the selected ffmpeg, lyt
inspects its container and requested media stream. Attached cover images do not
count as video streams. The optional probe cannot load remote media protocols,
has a ten-second timeout, and has bounded JSON output. No extra tool is installed.

`verified` means those checks succeeded, not that the whole file was decoded.
`file-only` records `ffprobe_missing`, `probe_unavailable`, or `probe_timeout` and
omits unmeasured metadata. A failed receipt has status `failed`; output paths
are retained and the job is not recorded as a successful download. A corrupt
history artifact similarly fails inspection without silently overwriting it.
Dry runs only plan work and do not emit actual-file receipts.

## Actionable errors

```json
{
  "message": "HTTP Error 429: Too Many Requests",
  "code": 1,
  "kind": "rate_limited",
  "retryable": true,
  "suggestion": "Wait before retrying and reduce concurrent requests."
}
```

`code` remains the numeric process/CLI exit code. `kind` is a stable recovery
category. `retryable` means the failure may be transient, not that a retry will
succeed or that an agent should retry indefinitely. No automatic retry loop is
introduced. Suggestions explain the next step and never authorize installation,
authentication, overwrites, or bypassing access controls.

Categories: `usage`, `tool_missing`, `tool_unavailable`, `setup_failed`, `network`, `rate_limited`,
`authentication_required`, `access_denied`, `media_unavailable`, `unsupported_url`,
`format_unavailable`, `filesystem`, `verification_failed`, `size_limit`,
`no_output`, `cancelled`, `tool_output_invalid`, and `unknown`.

Known lyt errors are tagged directly. Upstream stderr is classified conservatively;
unrecognized diagnostics fall back to `unknown`. HTTP 403 is `access_denied`, not
proof of a login problem. Tool setup failures are separate from missing tools.
A size limit is reported only when downloader diagnostics confirm that limit.
Tool version checks allow a bounded 15-second yt-dlp cold start; an installed
tool failing that check reports `tool_unavailable` rather than missing. Doctor
JSON includes the same actionable error shape for failed tool checks.

`lyt capabilities --json` exposes the error categories and command-specific search
options. These fields and receipts are additive to the existing v1 contracts.
Consumers should keep using `files` when they do not need receipts.
