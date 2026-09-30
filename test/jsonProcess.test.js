import test from "node:test";
import assert from "node:assert/strict";
import { runJsonTool } from "../src/jsonProcess.js";

test("JSON tool execution bounds output and rejects invalid output", async () => {
  assert.deepEqual(await runJsonTool(process.execPath, ["-e", "console.log(JSON.stringify({ok:true}))"]), { ok: true });
  await assert.rejects(runJsonTool(process.execPath, ["-e", "console.log('not JSON')"]), (error) => error.kind === "tool_output_invalid");
  await assert.rejects(runJsonTool(process.execPath, ["-e", "console.log('x'.repeat(10000))"], { maxBytes: 100 }), (error) => error.kind === "tool_output_invalid");
});

test("JSON tool requests time out and retain useful failure diagnostics", async () => {
  await assert.rejects(runJsonTool(process.execPath, ["-e", "setInterval(()=>{},1000)"], { timeoutMs: 150 }), (error) => error.kind === "network");
  await assert.rejects(runJsonTool(process.execPath, ["-e", "console.error('HTTP Error 429');process.exit(1)"]), (error) => error.diagnostic === "HTTP Error 429" && error.exitCode === 1);
});
