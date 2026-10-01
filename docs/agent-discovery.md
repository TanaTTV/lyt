# Agent discovery roadmap

This document tracks the lightweight distribution work that can make `lyt` easier for AI agents to discover and select.

## Near term

- Publish a portable root `plugin.json` so the repository can be packaged as an Agent Plugin.
- Keep the skill description focused on user intent, including phrases such as downloading video, saving audio or MP3, clipping media, inspecting formats, and preparing media for another workflow.
- Keep npm metadata aligned with those same intents.

## Later

- Consider a small `lyt mcp serve` surface if broader MCP-client discovery becomes useful.
- Publish that server to the MCP Registry only after the CLI/plugin workflow is stable.

The CLI remains the source of truth. This roadmap should not duplicate or fork media behavior outside `lyt`.
