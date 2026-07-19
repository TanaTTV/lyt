# lyt agent plugin

Give Codex or Claude Code a permission-first local media workflow backed by the
[`@tanattv/lyt`](https://www.npmjs.com/package/@tanattv/lyt) CLI.

## Prerequisite

```sh
npm install --global @tanattv/lyt
lyt doctor
```

## Install in Codex

```sh
codex plugin marketplace add TanaTTV/lyt
codex plugin add lyt@lyt-plugins
```

## Install in Claude Code

```sh
claude plugin marketplace add TanaTTV/lyt
claude plugin install lyt@lyt-plugins
```

Then ask your agent to download media you own or have permission to use. The
skill tells the agent to prefer lyt's versioned JSON contract, keep playlists
disabled unless requested, and report exact final paths from `results[].files`.

## Update

```sh
codex plugin marketplace upgrade lyt-plugins
codex plugin remove lyt@lyt-plugins
codex plugin add lyt@lyt-plugins

claude plugin update lyt@lyt-plugins
```

## Remove

```sh
codex plugin remove lyt@lyt-plugins
claude plugin uninstall lyt@lyt-plugins
```

Documentation: <https://tanattv.github.io/lyt/agents/>
