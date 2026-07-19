# Repository layout

The repository contains several public surfaces, but each folder has one clear
responsibility. Duplicate agent skill files are committed intentionally because
Codex, Claude Code, the npm package, and repository-local discovery expect
specific paths. Tests keep those copies byte-for-byte synchronized.

```text
lyt/
├── bin/                    Executable entry points: lyt, yt3, yt4
├── src/                    Canonical Node.js CLI implementation
├── test/                   Node test suite
├── schemas/                Versioned machine-readable contracts
├── skills/                 Canonical npm-packaged agent skill
├── plugins/lyt/            Codex and Claude marketplace package
├── .agents/                Codex repository discovery and marketplace metadata
├── .claude/                Claude repository-local skill discovery
├── .claude-plugin/         Claude marketplace catalog
├── app/                    Experimental Tauri desktop application
├── website/                Dependency-free static product website
├── install/                Optional platform helper installers
├── scripts/                Package, release, and smoke-test utilities
├── demos/                  Reproducible product demonstrations
├── docs/                   Maintainer and launch documentation
└── .github/                CI, release, Pages, and issue templates
```

## Canonical sources

- CLI behavior: `src/`
- Public executables: `bin/`
- Agent instructions: `skills/lyt/SKILL.md`
- Result contract: `schemas/lyt.result.v1.schema.json`
- Website content: `website/src/site.mjs`
- Website styling: `website/src/styles.css`
- Desktop status: `app/README.md`

## Generated or synchronized copies

The following skill copies must match `skills/lyt/SKILL.md`:

- `.agents/skills/lyt/SKILL.md`
- `.claude/skills/lyt/SKILL.md`
- `plugins/lyt/skills/lyt/SKILL.md`

`test/skill-copies.test.js` enforces this requirement.

## What belongs where

- New download behavior belongs in `src/` and requires tests in `test/`.
- Agent-only policy or workflow guidance begins in the canonical skill and is
  synchronized to the platform-specific copies.
- Product copy belongs in `website/src/site.mjs`, not in generated `dist/`.
- Build output, downloaded media, local reports, cookies, and private URLs must
  never be committed.
- Desktop download behavior should eventually call the canonical lyt engine
  rather than independently rebuilding yt-dlp arguments in Rust.

## Maintenance rule

Prefer adding a small focused module over expanding `src/cli.js`. The
`src/entry.js` layer handles public command preprocessing and compatibility,
while `src/cli.js` remains the established download coordinator. New product
features should avoid creating a second download engine.
