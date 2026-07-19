# lyt agent marketplace launch

## The launch goal

Recruit 20 hands-on Codex or Claude Code users, get at least 10 successful
plugin installs, and collect five concrete workflow reports before expanding
promotion. The first milestone is proven activation, not raw impressions.

## Best first users

- Developers who already use yt-dlp but repeatedly rebuild the same commands.
- AI-agent users who need permitted media saved locally with exact output paths.
- Video editors, researchers, and creators who want repeatable clips or audio.

## The promise

> Give Codex or Claude one permitted media URL. lyt handles the local tools,
> safe defaults, quality, and exact final path.

## Ready-to-post launch copy

### GitHub or community post

I built **lyt**, an open-source local media CLI designed for both people and AI
agents. It wraps yt-dlp with memorable quality options, automatic tool setup,
safe single-item defaults, and a stable JSON result containing the exact final
file path.

It now installs as a plugin for Codex and Claude Code. I am looking for 20 early
testers who already work with permitted video or audio and can tell me where the
workflow breaks.

```sh
npm install --global @tanattv/lyt
```

Project: https://github.com/TanaTTV/lyt

### Short social post

I made yt-dlp easier for people and AI agents. lyt installs locally, keeps safe
defaults on, returns exact final paths as JSON, and now has Codex + Claude Code
plugins. Looking for early testers: https://github.com/TanaTTV/lyt

## Feedback questions

Ask each tester only these four questions:

1. Did the marketplace and CLI installation work on the first attempt?
2. Did the agent choose the right command without correction?
3. Did the returned file and path match what you expected?
4. What is the first task you tried that lyt could not complete?

## Seven-day sequence

| Day | Action | Success signal |
| --- | --- | --- |
| 1 | Merge marketplace packaging and record the 30-second demo | Both local CLI validations pass |
| 2 | Invite five known agent users personally | Three installs completed |
| 3 | Publish the demo on GitHub and one relevant community | Five total installs or replies |
| 4 | Fix the first repeated activation issue | Affected tester confirms the fix |
| 5 | Share one real workflow and exact result | Two new testers try that workflow |
| 6 | Collect objections and missing commands | Top three issues are documented |
| 7 | Publish what changed from tester feedback | Ten successful installs total |

## Metrics to track

- Marketplace add succeeded
- Plugin install succeeded
- `lyt doctor` passed
- First permitted file completed
- Exact final path returned
- User came back for a second task

Do not ask for stars before someone succeeds with the product. Ask for a star
after the second useful task, when it represents genuine intent to return.
