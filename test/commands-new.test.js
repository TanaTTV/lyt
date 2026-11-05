import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseVtt, transcriptText, formatTimestamp, fetchTranscript } from "../src/transcript.js";
import { parseTranscriptArgs, runTranscriptCommand } from "../src/commands/transcript.js";
import { openerFor, runLastCommand } from "../src/commands/history.js";
import { completionScript } from "../src/completion.js";
import { OPTIONS } from "../src/capabilities.js";
import { callTool, handleMessage, runMcpServer, toolArgv, TOOLS } from "../src/mcp.js";
import { parseArgs } from "../src/ytDlp.js";
import { writeFileSync } from "node:fs";

const usage = (fn) => assert.throws(fn, (error) => error.exitCode === 2);

const ROLLING_VTT = `WEBVTT
Kind: captions
Language: en

00:00:00.320 --> 00:00:02.150 align:start position:0%

hello<00:00:00.800><c> there</c>

00:00:02.150 --> 00:00:02.160 align:start position:0%
hello there


00:00:02.160 --> 00:00:04.000 align:start position:0%
hello there
it&#39;s a test &amp; more

00:00:09.000 --> 00:00:10.500
New paragraph after a pause
`;

test("VTT parsing strips tags, decodes entities, and drops rolling duplicates", () => {
  const segments = parseVtt(ROLLING_VTT);
  assert.deepEqual(segments.map((segment) => segment.text), [
    "hello there",
    "it's a test & more",
    "New paragraph after a pause",
  ]);
  assert.equal(segments[0].start, 0.32);
  assert.equal(transcriptText(segments), "hello there it's a test & more\n\nNew paragraph after a pause");
});

test("SRT captions parse with the same reader", () => {
  const segments = parseVtt("1\n00:01:02,500 --> 00:01:04,000\nFirst line\n\n2\n00:01:04,000 --> 00:01:05,000\nSecond\n");
  assert.deepEqual(segments, [
    { start: 62.5, end: 64, text: "First line" },
    { start: 64, end: 65, text: "Second" },
  ]);
});

test("timestamps format as m:ss or h:mm:ss", () => {
  assert.equal(formatTimestamp(65.9), "1:05");
  assert.equal(formatTimestamp(3725), "1:02:05");
});

test("transcript arguments are validated", () => {
  assert.deepEqual(parseTranscriptArgs(["--lang", "pt-BR", "--timestamps", "https://x.test/v"]), {
    url: "https://x.test/v", language: "pt-BR", timestamps: true, json: false, noDownload: false, help: false,
  });
  usage(() => parseTranscriptArgs([]));
  usage(() => parseTranscriptArgs(["--lang", "en;rm", "u"]));
  usage(() => parseTranscriptArgs(["a", "b"]));
});

// A fake yt-dlp: writes a caption file where -o points, then prints -J JSON.
function fakeYtDlp(media, vtt) {
  return (command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    const template = args[args.indexOf("-o") + 1];
    queueMicrotask(() => {
      if (vtt) writeFileSync(template.replace("%(ext)s", "en.vtt"), vtt);
      child.stdout.end(JSON.stringify(media));
      child.stderr.end();
      setImmediate(() => child.emit("close", 0));
    });
    return child;
  };
}

test("fetchTranscript reports language, caption kind, chapters, and text", async () => {
  const media = {
    id: "abc", title: "Talk", duration: 61.4,
    subtitles: {}, automatic_captions: { en: [] },
    requested_subtitles: { en: { ext: "vtt" } },
    chapters: [{ start_time: 0, end_time: 30, title: "Intro" }],
  };
  const result = await fetchTranscript("https://youtu.be/abc", { spawnFn: fakeYtDlp(media, ROLLING_VTT), runtimeArgs: [] });
  assert.equal(result.language, "en");
  assert.equal(result.automatic, true);
  assert.equal(result.durationSeconds, 61);
  assert.deepEqual(result.chapters, [{ start: 0, end: 30, title: "Intro" }]);
  assert.equal(result.segments.length, 3);
});

test("fetchTranscript names other caption languages when the requested one is missing", async () => {
  const media = { id: "abc", subtitles: { es: [], fr: [] }, automatic_captions: { "de-orig": [] }, requested_subtitles: null };
  await assert.rejects(
    fetchTranscript("https://youtu.be/abc", { spawnFn: fakeYtDlp(media, null), runtimeArgs: [] }),
    (error) => error.kind === "no_output" && /Available: es, fr, de/.test(error.message),
  );
});

test("transcript --json prints one lyt.transcript.v1 document", async () => {
  const lines = [];
  await runTranscriptCommand(["--json", "https://youtu.be/abc"], {
    ensureTool: async () => "yt-dlp",
    transcript: async () => ({ id: "abc", language: "en", automatic: false, chapters: [], segments: [], text: "" }),
    log: (line) => lines.push(line),
  });
  const output = JSON.parse(lines[0]);
  assert.equal(output.schema, "lyt.transcript.v1");
  assert.equal(output.ok, true);
});

test("lyt last prints the newest entry whose files still exist and can open it", () => {
  const lines = [];
  const launched = [];
  runLastCommand(["--reveal"], {
    entries: [{ url: "x", title: "First", files: ["/m/old.mp3"] }, { url: "y", title: "Newest", files: ["/m/gone.mp4"] }],
    exists: (file) => file !== "/m/gone.mp4",
    log: (line) => lines.push(line),
    launch: (command, args) => launched.push([command, args]),
  });
  assert.deepEqual(lines, ["/m/old.mp3"]);
  assert.equal(launched.length, 1);
  assert.throws(
    () => runLastCommand(["nothing-like-this"], { entries: [], log: () => {}, exists: () => true }),
    (error) => error.kind === "no_output",
  );
  usage(() => runLastCommand(["--open", "--reveal"], { entries: [], log: () => {} }));
});

test("open and reveal use each platform's file manager", () => {
  assert.deepEqual(openerFor("/a/b.mp4", { platform: "darwin", reveal: true }), { command: "open", args: ["-R", "/a/b.mp4"] });
  assert.deepEqual(openerFor("C:\\a\\b.mp4", { platform: "win32", reveal: true }), { command: "explorer.exe", args: ["/select,C:\\a\\b.mp4"] });
  assert.deepEqual(openerFor("/a/b.mp4", { platform: "linux", reveal: true }), { command: "xdg-open", args: ["/a"] });
});

test("completion scripts list every published flag", () => {
  for (const shell of ["bash", "zsh", "fish"]) {
    const script = completionScript(shell);
    for (const option of OPTIONS) {
      const needle = shell === "fish" ? `-l ${option.flag.slice(2)}` : option.flag;
      assert.ok(script.includes(needle), `${shell} misses ${option.flag}`);
    }
  }
  assert.match(completionScript("bash"), /complete -F _lyt_complete lyt yt3 yt4/);
  usage(() => completionScript("powershell"));
  const check = spawnSync("bash", ["-n"], { input: completionScript("bash") });
  if (check.error?.code !== "ENOENT") assert.equal(check.status, 0, String(check.stderr));
});

test("MCP tool arguments map to fixed lyt flags with the URL after --", () => {
  assert.deepEqual(
    toolArgv("lyt_download", { url: "--exec=evil", mode: "video", editor: true, clips: ["1:00-2:00"], name: "x" }),
    ["--json", "--video", "--editor", "--clip", "1:00-2:00", "--name", "x", "--", "--exec=evil"],
  );
  assert.throws(() => toolArgv("lyt_download", { url: "u", args: "--exec" }), /Unknown argument/);
  assert.throws(() => toolArgv("lyt_download", {}), /url must be/);
  assert.throws(() => toolArgv("lyt_nope", {}), /Unknown tool/);
  // Every mapped download flag is one the CLI parser accepts.
  const argv = toolArgv("lyt_download", {
    url: "https://youtu.be/abc", mode: "video", editor: true, audioFormat: "wav", container: "mkv",
    quality: "1080p", clips: ["1-2"], chapters: ["Intro"], subs: true, name: "n", outputDir: "o", playlist: true, maxItems: 3,
  });
  assert.doesNotThrow(() => parseArgs(argv));
  for (const tool of TOOLS) assert.equal(tool.inputSchema.type, "object");
});

test("MCP server answers initialize, tools/list, tools/call, and unknown methods", async () => {
  const init = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
  assert.equal(init.result.protocolVersion, "2024-11-05");
  assert.equal(init.result.serverInfo.name, "lyt");
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" })).result.tools.length, TOOLS.length);
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 3, method: "nope" })).error.code, -32601);
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "lyt_info", arguments: {} } })).error.code, -32602);

  const run = async (argv) => ({ code: 1, stdout: JSON.stringify({ ok: false, argv }), stderr: "" });
  const called = await callTool("lyt_info", { url: "https://x.test/v" }, { run });
  assert.equal(called.isError, true);
  assert.deepEqual(called.structuredContent.argv, ["info", "--json", "--", "https://x.test/v"]);
});

test("MCP server speaks newline-delimited JSON-RPC over streams", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk) => { text += chunk; });
  const done = runMcpServer({ input, output, run: async () => ({ code: 0, stdout: "{\"ok\":true}", stderr: "" }) });
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })}\n`);
  input.write("not json\n");
  input.end(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "lyt_doctor", arguments: {} } })}\n`);
  await done;
  const replies = text.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.find((reply) => reply.id === 1).result, {});
  assert.equal(replies.find((reply) => reply.error?.code === -32700).id, null);
  assert.equal(replies.find((reply) => reply.id === 2).result.isError, false);
});

test("lyt mcp starts from the real entry point and lists tools", () => {
  const bin = fileURLToPath(new URL("../bin/lyt.js", import.meta.url));
  const run = spawnSync(process.execPath, [bin, "mcp"], {
    input: `${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" })}\n`,
    encoding: "utf8",
    env: { ...process.env, LYT_NO_UPDATE_CHECK: "1" },
    timeout: 10_000,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout.trim()).result.tools[0].name, "lyt_search");
});
