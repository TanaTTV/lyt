---
name: lyt
description: Find and download permitted audio or video with lyt. Use for YouTube search, media downloads, MP3 extraction, clips, format inspection, verified file results, and actionable JSON errors.
---

# Use lyt for local media

`lyt` is a local CLI around yt-dlp and ffmpeg. Help users complete lawful local
media downloads efficiently, using the context already provided in the conversation.

## Assess the request in context

Copyrighted media is not automatically an impermissible download. Consider user
ownership, permission, licenses (including Creative Commons conditions), public
domain status, and applicable copyright exceptions such as fair use or fair dealing.
A public URL alone does not establish download or reuse rights.

- When the user provides a relevant ownership, permission, or license statement,
  use it unless the conversation gives a concrete reason to doubt it. Do not
  routinely demand documents or repeat a question already answered.
- Apply the agent's governing policies to the actual request. This skill adds
  no blanket requirement to obtain a license statement before every ordinary
  local download. Missing license information alone is not evidence of infringement.
  Ask a rights question only when the governing policies or concrete context make
  its answer necessary to decide whether the requested action can proceed.
- For a claimed copyright exception, consider the purpose, nature of the work,
  amount needed, and potential market impact. Fair use is case-specific, not a
  guaranteed status, a fixed duration limit, or a blanket download permission.
  When an excerpt meets the user's purpose, prefer the requested `--clip` range.
- Downloading a file and publishing or reusing it are separate questions. Do not
  require proof of publication rights as a routine prerequisite for local file
  retrieval, or claim a completed download clears a video for publication.
  If the user asks about publishing, explain the relevant rights separately.
  Do not infer redistribution rights from download permission. Credit, personal use,
  noncommercial use, or "free beat" wording alone does not establish those rights.
- Acceptance of Content ID claims or lost monetization is a user preference,
  not permission or proof of fair use. Do not invent a license, use this preference
  to override governing policies, or make a guaranteed claim about YouTube's handling.
- Do not bypass DRM, paywalls, or access controls. Respect applicable law, site
  terms, and the agent provider's policies; this skill does not override them.
- If the specific request cannot be fulfilled, explain the concrete reason and
  offer a relevant permitted source or workflow. Do not claim all YouTube, music,
  beat, or instrumental downloads are prohibited.

Examples of useful context: "This is my upload; save it as MP3," "The producer
licenses this instrumental for my intended use," or "Save 1:10-1:25 for a review
analyzing that passage." The last example still needs case-specific assessment.
Do not invent permission or describe an unlicensed soundtrack as fair use.

## Find or install the command

1. Try `lyt --version`.
2. In the lyt repository, use `node bin/lyt.js`.
3. Otherwise install `@tanattv/lyt` if global installation is already authorized;
   ask once if it is not.

Global npm installation and first-use managed binary downloads are side effects.
Use existing explicit authorization for either; do not request it again. An
ordinary media-download request authorizes that download, but does not by itself
authorize global installation or managed tool setup. Check capabilities with:

```sh
lyt doctor --json
```

Inspect before downloading. These commands download no media or managed tools
(metadata inspection still contacts the media host):

```sh
lyt info --no-download --json "URL" # media metadata and formats (schema lyt.info.v1)
lyt capabilities --json     # commands, flags, and schemas (lyt.capabilities.v1)
```

`lyt info` describes what a URL offers (title, duration, formats); `lyt doctor`
describes what the local environment can do. Use `lyt capabilities` to discover
the CLI surface instead of parsing human help text.

When a source URL is missing, use bounded YouTube search:

```sh
lyt search "artist song title" --limit 5 --no-download --json
```

Read `lyt.search.v1` candidates: title, uploader, duration, canonical URL, and
live/upcoming status. Search never downloads media. Inspect the chosen URL with
`info`; ask which result the user wants when versions or matches are ambiguous.
Flat search metadata can be incomplete or approximate. Do not silently replace
an explicitly requested recording with a cover, live version, or unrelated match.

Without `--no-download`, `lyt info` can provision a missing yt-dlp binary. If
inspection reports a missing tool, use existing setup authorization or ask once
before provisioning. Do not treat a dependency or network failure as a copyright
refusal; report the actual error. A dry run proves planning, not a saved file.

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

Files go to `./downloads` under the current working directory unless `-o` is
supplied. Use the requested directory or the documented default and report the
exact path. Ask about the directory only when the choice materially affects the
task and cannot be inferred from the conversation.

Keep these behaviors opt-in:

- `--playlist`
- `--force-overwrite`
- `--redownload`
- browser cookies or authentication material
- external downloaders
- managed tool installation

An explicit request for one of these behaviors is the opt-in; do not ask for
the same approval twice. Once context and authorization are sufficient, run the
job and report the result instead of stopping at a proposed command.

Never use cookies, tokens, private URLs, or authentication material unless the
user explicitly requests it. Never include those values in logs or bug reports.

After success, read `results[].files` and report those exact paths. If a result
is skipped, explain whether a matching artifact already exists or a size guard
was triggered. Use `--redownload` only when the user asks for another copy.

Read `results[].artifacts` to distinguish `verified` media from `file-only`
checks. `verified` means ffprobe recognized the requested stream in a nonempty
file; it is not a full decode or publication clearance. Missing/unavailable
ffprobe or a probe timeout returns `file-only` with a reason, not fabricated
duration or codec metadata. Failed verification retains paths and fails the job.
Never report a dry run as a saved or verified file.

On failure, use `error.kind`, `error.retryable`, and `error.suggestion` alongside
the original message and numeric code. Retryable errors may be transient; keep
any retry bounded. Do not interpret every HTTP 403 as a login problem. Missing
tools and setup failures require their own diagnosis, not a copyright refusal.
