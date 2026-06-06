# yt2audio MCP server

Minimal [Model Context Protocol](https://modelcontextprotocol.io/) server that wraps `yt3` for agent-driven audio downloads.

Requires the `--json` CLI flag (see parent repo PR for `--json`).

## Setup

```bash
cd mcp
npm install
```

## Cursor / Claude Desktop config

Add to your MCP settings:

```json
{
  "mcpServers": {
    "yt2audio": {
      "command": "node",
      "args": ["C:/path/to/yt2audio-fast/mcp/server.js"]
    }
  }
}
```

Use the absolute path to `server.js` on your machine.

## Tools

| Tool | Description |
| --- | --- |
| `preview_download` | Dry-run: shows the yt-dlp command without downloading |
| `download_audio` | Downloads audio and returns JSON with output file path |

Both tools accept `url`, optional `mp3`, `output_dir`, and `cookies_from_browser`.
