import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { runJsonTool } from "../src/jsonProcess.js";

function tool() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kills = [];
  child.kill = (signal) => { child.kills.push(signal); child.emit("close", null); };
  return child;
}

test("metadata timeouts terminate the tool and ignore late output", async () => {
  const child = tool();
  await assert.rejects(runJsonTool("fixture", [], {
    spawnFn: () => child, timeoutMs: 10,
  }), /timed out/);
  assert.deepEqual(child.kills, ["SIGKILL"]);
  child.stdout.write('{"late":true}');
  child.emit("close", 0);
});

test("metadata limits count stdout and stderr bytes together", async () => {
  const child = tool();
  const pending = runJsonTool("fixture", [], { spawnFn: () => child, maxBytes: 5 });
  child.stdout.write("123");
  child.stderr.write("456");
  await assert.rejects(pending, /exceeded the permitted size/);
  assert.deepEqual(child.kills, ["SIGKILL"]);
});

test("tool success, malformed JSON, and spawn errors all settle cleanly", async () => {
  for (const stdout of ['{"ok":true}', "invalid"]) {
    const child = tool();
    const pending = runJsonTool("fixture", [], { spawnFn: () => child });
    child.stdout.write(stdout);
    child.emit("close", 0);
    if (stdout === "invalid") await assert.rejects(pending, /parse tool JSON/);
    else assert.deepEqual(await pending, { ok: true });
    assert.deepEqual(child.kills, []);
  }
  const child = tool();
  const pending = runJsonTool("fixture", [], { spawnFn: () => child });
  child.emit("error", new Error("spawn failed"));
  await assert.rejects(pending, /spawn failed/);
});
