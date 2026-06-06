#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yt3 = join(root, "bin", "yt3.js");

const server = new Server(
  { name: "yt2audio", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "preview_download",
      description:
        "Preview the yt-dlp command for a YouTube audio download without downloading.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "YouTube video URL" },
          mp3: { type: "boolean", description: "Convert to MP3 (default: native audio)" },
          output_dir: { type: "string", description: "Output directory (default: downloads)" },
        },
        required: ["url"],
      },
    },
    {
      name: "download_audio",
      description: "Download YouTube audio to a local folder. Returns JSON with file paths.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "YouTube video URL" },
          mp3: { type: "boolean", description: "Convert to MP3 (default: native audio)" },
          output_dir: { type: "string", description: "Output directory (default: downloads)" },
          cookies_from_browser: {
            type: "string",
            description: "Browser for cookies, e.g. chrome, firefox, edge",
          },
        },
        required: ["url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === "preview_download") {
    const result = await runYt3(args, { dryRun: true });
    return toolResult(result);
  }

  if (name === "download_audio") {
    const result = await runYt3(args, { dryRun: false });
    return toolResult(result);
  }

  throw new Error(`Unknown tool: ${name}`);
});

function toolResult(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: payload.ok === false,
  };
}

async function runYt3(args, { dryRun }) {
  const argv = ["--json"];

  if (dryRun) {
    argv.push("--dry-run");
  }

  if (args.mp3) {
    argv.push("--mp3");
  }

  if (args.output_dir) {
    argv.push("-o", args.output_dir);
  }

  if (args.cookies_from_browser) {
    argv.push("--cookies-from-browser", args.cookies_from_browser);
  }

  argv.push(args.url);

  const { stdout, stderr, code } = await spawnCollect(process.execPath, [yt3, ...argv]);

  try {
    return JSON.parse(stdout.trim() || "{}");
  } catch {
    return {
      ok: false,
      error: stderr.trim() || stdout.trim() || `yt3 exited with code ${code}`,
    };
  }
}

function spawnCollect(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
