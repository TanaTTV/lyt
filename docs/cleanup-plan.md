# Major code cleanup plan (implemented on `cleanup/major-code-hygiene`)

This document is the PR-facing summary of the multi-agent cleanup plan.
Behavior of the public CLI is intentionally unchanged.

## Goals

- Remove dead code and shadow subcommand handlers
- One owner per subcommand
- Slim `cli.js` into a download coordinator
- Shared error helpers and VALUE_OPTIONS guard
- Keep zero npm runtime dependencies
- Do not break `lyt` / `yt3` / `yt4`, flags, JSON schemas, or agent skills

## Architecture after cleanup

```text
bin/{lyt,yt3,yt4}.js
        │
        ▼
   src/entry.js          sole public router + download argv prep
        │
        ├── history  → commands/history.js  (lyt.history.v1)
        ├── doctor   → doctor.js            (lyt.doctor.v1)
        ├── config   → commands/config.js
        ├── agent    → commands/agent.js
        └── download → cli.js → download.js / process.js / …
```

## What changed

| Area | Change |
| --- | --- |
| Dead code | Removed unused `outputTemplate` / `outputParent`; removed cli shadow history/doctor |
| Commands | `src/commands/{history,config,agent}.js` |
| Errors | `src/errors.js` (`usageError`, `handleCliError`) |
| Download engine | `src/download.js` (tools, workers, watch) |
| Process I/O | `src/process.js` (`runCommand`) |
| Clipboard policy | helpers live in `clipboard.js` |
| Format printing | `printFormats` in `formats.js` |
| VALUE_OPTIONS | single set in `ytDlp.js`, used by entry dedupe + unit test |
| URL dedupe | `dedupeUrlList` in `urls.js` |

## Public surface (frozen)

- Bins: `lyt`, `yt3` (audio defaults), `yt4` (video defaults)
- Subcommands: `history`, `config`, `doctor`, `agent install`
- Schemas: `lyt.result.v1`, `lyt.history.v1`, `lyt.doctor.v1`
- Skills: `skills/lyt/SKILL.md` + synced copies
- npm `files`: bin, src, skills, schemas, install, README, CHANGELOG, LICENSE

## Out of scope

- Search / inspect (v0.8)
- Download throughput features (aria2 defaults, higher fragments)
- Tauri app engine rewrite
- Removing `yt3` / `yt4` bins
- Adding npm runtime dependencies

## Verify before merge

```sh
npm test
npm run check
node bin/lyt.js --help
node bin/lyt.js doctor --json
node bin/lyt.js history --json
node bin/lyt.js --dry-run --json "URL"
node bin/yt3.js --help
node bin/yt4.js --help
```

## Versioning

Pure internal cleanup → shipped via **#41** (merged). Agent introspection
(`info` / `capabilities`) ports onto that base as the first **v0.8** product
slice (updated **#40**).
