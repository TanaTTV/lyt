// `lyt mcp` — a Model Context Protocol server over stdio (newline-delimited
// JSON-RPC 2.0). Each tool runs the lyt CLI itself with --json, so MCP clients
// get exactly the same behavior, validation, and result schemas as the CLI.
// Tool arguments are mapped to a fixed set of flags; there is no raw
// passthrough, and URLs always follow `--`.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { AUDIO_FORMATS, VIDEO_CONTAINERS } from "./ytDlp.js";
import { VERSION } from "./version.js";

export const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOLS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);
const LYT_BIN = fileURLToPath(new URL("../bin/lyt.js", import.meta.url));
const MAX_OUTPUT = 4 * 1024 * 1024;

const urlProperty = { type: "string", description: "Media page URL (YouTube, SoundCloud, Vimeo, Spotify, or another yt-dlp site)." };

export const TOOLS = [
  {
    name: "lyt_search",
    title: "Search YouTube",
    description: "Find YouTube videos for a query. Returns candidates (title, channel, duration, URL); never downloads.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 500 },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 5 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "lyt_info",
    title: "Inspect media",
    description: "Read title, duration, chapters, and available qualities for a media URL without downloading it.",
    inputSchema: { type: "object", properties: { url: urlProperty }, required: ["url"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "lyt_transcript",
    title: "Get transcript",
    description: "Get a video's subtitles or automatic captions as text with timestamps and chapters. Downloads only the caption file.",
    inputSchema: {
      type: "object",
      properties: {
        url: urlProperty,
        lang: { type: "string", pattern: "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$", default: "en" },
      },
      required: ["url"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "lyt_download",
    title: "Download media",
    description:
      "Download audio or video with lyt and return the verified file paths (lyt.result.v1). " +
      "Saves files to disk. Use for media the user has the right or permission to save; " +
      "lyt does not bypass DRM, paywalls, or access controls.",
    inputSchema: {
      type: "object",
      properties: {
        url: urlProperty,
        mode: { type: "string", enum: ["audio", "video"], default: "audio" },
        editor: { type: "boolean", description: "Video for editing: prefer H.264 + AAC in MP4." },
        audioFormat: { type: "string", enum: AUDIO_FORMATS },
        container: { type: "string", enum: VIDEO_CONTAINERS },
        quality: { type: "string", description: "Audio bitrate (192K) or video resolution (1080p, 4k)." },
        clips: { type: "array", items: { type: "string" }, maxItems: 20, description: "Sections like 1:10-2:45." },
        chapters: { type: "array", items: { type: "string" }, maxItems: 20, description: "Chapter titles (or parts) to keep." },
        subs: { type: "boolean" },
        name: { type: "string", description: "Output file name without extension." },
        outputDir: { type: "string", description: "Destination folder (default: downloads)." },
        playlist: { type: "boolean", description: "Allow playlists and channels (opt-in)." },
        maxItems: { type: "integer", minimum: 1 },
      },
      required: ["url"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "lyt_doctor",
    title: "Check setup",
    description: "Report whether Node, yt-dlp, and ffmpeg are ready, including yt-dlp freshness. Changes nothing.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

function invalid(message) {
  const error = new Error(message);
  error.rpcCode = -32602;
  return error;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw invalid(`${name} must be a non-empty string.`);
  return value;
}

function stringList(value, name) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw invalid(`${name} must be an array of non-empty strings.`);
  }
  return value;
}

// Maps validated tool arguments to a lyt argv. Unknown keys are rejected.
export function toolArgv(name, input = {}) {
  const args = input && typeof input === "object" ? input : {};
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw invalid(`Unknown tool: ${name}`);
  for (const key of Object.keys(args)) {
    if (!Object.hasOwn(tool.inputSchema.properties, key)) throw invalid(`Unknown argument for ${name}: ${key}`);
  }

  switch (name) {
    case "lyt_search": {
      const argv = ["search", "--json"];
      if (args.limit != null) argv.push("--limit", String(args.limit));
      return [...argv, "--", requireString(args.query, "query")];
    }
    case "lyt_info":
      return ["info", "--json", "--", requireString(args.url, "url")];
    case "lyt_transcript": {
      const argv = ["transcript", "--json"];
      if (args.lang != null) argv.push("--lang", requireString(args.lang, "lang"));
      return [...argv, "--", requireString(args.url, "url")];
    }
    case "lyt_doctor":
      return ["doctor", "--json"];
    case "lyt_download": {
      const argv = ["--json"];
      if (args.mode === "video") argv.push("--video");
      else if (args.mode != null && args.mode !== "audio") throw invalid("mode must be audio or video.");
      if (args.editor === true) argv.push("--editor");
      if (args.audioFormat != null) argv.push("--audio-format", requireString(args.audioFormat, "audioFormat"));
      if (args.container != null) argv.push("--container", requireString(args.container, "container"));
      if (args.quality != null) argv.push("--quality", requireString(args.quality, "quality"));
      for (const clip of stringList(args.clips, "clips")) argv.push("--clip", clip);
      for (const chapter of stringList(args.chapters, "chapters")) argv.push("--chapter", chapter);
      if (args.subs === true) argv.push("--subs");
      if (args.name != null) argv.push("--name", requireString(args.name, "name"));
      if (args.outputDir != null) argv.push("--output-dir", requireString(args.outputDir, "outputDir"));
      if (args.playlist === true) argv.push("--playlist");
      if (args.maxItems != null) argv.push("--max-items", String(args.maxItems));
      return [...argv, "--", requireString(args.url, "url")];
    }
    default:
      throw invalid(`Unknown tool: ${name}`);
  }
}

export function runLyt(argv, { spawnFn = spawn, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawnFn(process.execPath, [LYT_BIN, ...argv], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...env, LYT_NO_UPDATE_CHECK: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { if (stdout.length < MAX_OUTPUT) stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { if (stderr.length < MAX_OUTPUT) stderr += chunk; });
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function callTool(name, input, { run = runLyt } = {}) {
  const { code, stdout, stderr } = await run(toolArgv(name, input));
  const lastLine = stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
  let structured = null;
  try { structured = JSON.parse(lastLine); } catch { /* Not JSON; fall back to text. */ }
  const text = structured ? JSON.stringify(structured) : (stdout.trim() || stderr.trim() || `lyt exited with code ${code}.`);
  return {
    content: [{ type: "text", text }],
    ...(structured && typeof structured === "object" && !Array.isArray(structured) ? { structuredContent: structured } : {}),
    isError: code !== 0 || structured?.ok === false,
  };
}

export async function handleMessage(message, { run } = {}) {
  const { id, method, params } = message ?? {};
  const isRequest = id !== undefined && id !== null;
  const reply = (result) => (isRequest ? { jsonrpc: "2.0", id, result } : null);
  const fail = (code, text) => (isRequest ? { jsonrpc: "2.0", id, error: { code, message: text } } : null);

  if (message?.jsonrpc !== "2.0" || typeof method !== "string") return fail(-32600, "Invalid request.");

  switch (method) {
    case "initialize": {
      const requested = params?.protocolVersion;
      return reply({
        protocolVersion: SUPPORTED_PROTOCOLS.has(requested) ? requested : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "lyt", title: "lyt media downloader", version: VERSION },
        instructions:
          "lyt downloads audio and video with yt-dlp. Use lyt_info or lyt_search before downloading, " +
          "lyt_transcript for spoken content, and lyt_download only for what the user asked to save. " +
          "Failed results carry error.kind, error.retryable, and error.suggestion.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call":
      try {
        return reply(await callTool(params?.name, params?.arguments ?? {}, { run }));
      } catch (error) {
        return fail(error.rpcCode ?? -32603, error.message);
      }
    default:
      if (method.startsWith("notifications/")) return null;
      return fail(-32601, `Method not found: ${method}`);
  }
}

export function runMcpServer({ input = process.stdin, output = process.stdout, run } = {}) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  const write = (payload) => { if (payload) output.write(`${JSON.stringify(payload)}\n`); };
  const pending = new Set();
  lines.on("line", (line) => {
    if (line.trim() === "") return;
    let message;
    try { message = JSON.parse(line); }
    catch { write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } }); return; }
    const task = handleMessage(message, { run }).then(write, (error) =>
      write({ jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32603, message: error.message } }));
    pending.add(task);
    task.finally(() => pending.delete(task));
  });
  return new Promise((resolve) => {
    lines.on("close", () => Promise.allSettled([...pending]).then(() => resolve()));
  });
}
