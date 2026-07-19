# lyt 0.7.1 release checklist

Version recommendation: **0.7.1**. This patch release changes branding,
documentation, discovery metadata, community guidance, and the public website
without changing CLI behavior or the `lyt.result.v1` contract.

## Automated gates

- [ ] `npm run check` passes.
- [ ] `node bin/lyt.js --version` prints `lyt 0.7.1`.
- [ ] `npm pack --dry-run --json` contains the intended CLI package only.
- [ ] `npm run build` passes in `website/` with the production `SITE_URL`.
- [ ] Website metadata and internal-link validation pass.
- [ ] CI passes on Node 20 and 22 across Windows, macOS, and Linux.
- [ ] GitHub Pages deployment completes from `main`.

## Public surfaces

- [ ] GitHub description uses the agent-ready local media positioning.
- [ ] GitHub homepage points to `https://tanattv.github.io/lyt/`.
- [ ] GitHub topics include AI-agent, Codex, Claude Code, and local-first terms.
- [ ] npm README, version, homepage, keywords, and changelog match `0.7.1`.
- [ ] The public website loads on desktop and mobile.
- [ ] Install and agent commands on the website match the packaged CLI.

## Release

- [ ] Merge the launch-site pull request.
- [ ] Create GitHub Release `v0.7.1` from the changelog entry.
- [ ] Confirm the trusted-publishing workflow publishes npm `0.7.1`.
- [ ] Verify `npm view @tanattv/lyt version` returns `0.7.1`.
- [ ] Run one clean global install and `lyt doctor` smoke test.

Publish only after the pull request and all required checks pass.
