# Discovery release and directory preparation

## Shipped surfaces

The website provides three task guides: `/codex-audio/`, `/claude-video/`, and
`/agent-clips/`. They are linked from `/agents/`, `llms.txt`, `llms-full.txt`, and
the sitemap. Crawl permission does not guarantee indexing or model selection.
The npm package includes AI.md, SECURITY.md, the skill, and result schemas.
The Codex installer uses the documented `~/.agents/skills` location.

Run `npm run check` and `npm run smoke:pack`. The latter performs installation
and verifies exact skill bytes at the supported agent locations. Release checks
validate versions, skill copies, documentation, and listing assets.

## Evaluate actual skill selection

`evals/skill-selection.json` contains natural prompts that never name lyt.
In a fresh Codex or Claude Code session with only the intended installed skill,
supply a small permitted media URL for each positive case. Record agent version,
case ID, skill selection, commands, exit status, and actual returned paths.
Run negative cases too. Do not equate frontmatter checks with model evaluations.
No actual model-selection pass is claimed by the automated release check.
A network failure is distinct from failure to select the skill.

## Directory submission

The existing plugin is instruction-based and needs shell access to execute lyt.
Do not describe it as a hosted downloader or remote MCP server. Do not submit a
CLI-only package to the MCP Registry as if it were an MCP server.

- OpenAI: follow https://developers.openai.com/plugins/deploy/submission.
  Upload a ZIP of the contents of `plugins/lyt` (the `.codex-plugin` manifest
  at the ZIP root), select a verified developer identity, resolve automated
  findings, and submit for review. The subtitle and icon paths are prepared.
  Check execution support on the target surface. Portal validation and approval
  remain external gates; local checks do not imply acceptance.
- Anthropic: follow https://code.claude.com/docs/en/plugins/publish.
  Its directory submission starts at https://claude.ai/directory/manage and
  requires the appropriate paid account. This differs from the bundled official
  marketplace, which does not accept submissions through that portal.
- Existing custom marketplaces remain usable with the README installation
  commands. A directory listing does not automatically install a skill.

Account verification, legal declarations, directory review, and search-console
ownership cannot be inferred from repository access. Record actual submission
IDs and outcomes when those steps are completed; never advertise pending listings
as accepted. Refresh directory packages after every version change.

## Sources checked on 2026-10-01

- Codex local skill locations: https://learn.chatgpt.com/docs/build-skills
- OpenAI submission: https://developers.openai.com/plugins/deploy/submission
- Claude distribution: https://code.claude.com/docs/en/plugins/publish
