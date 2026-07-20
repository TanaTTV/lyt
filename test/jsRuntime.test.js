import test from "node:test";
import assert from "node:assert/strict";
import { ytDlpJsRuntimeArgs } from "../src/jsRuntime.js";

test("uses Node 22 and newer as yt-dlp's JavaScript runtime", () => {
  assert.deepEqual(
    ytDlpJsRuntimeArgs({
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      nodeVersion: "22.0.0",
    }),
    ["--js-runtimes", "node:C:\\Program Files\\nodejs\\node.exe"],
  );
});

test("does not enable Node versions unsupported by yt-dlp", () => {
  assert.deepEqual(
    ytDlpJsRuntimeArgs({ execPath: "/usr/bin/node", nodeVersion: "20.19.0" }),
    [],
  );
});

test("does not emit an invalid runtime argument", () => {
  assert.deepEqual(
    ytDlpJsRuntimeArgs({ execPath: "", nodeVersion: "24.0.0" }),
    [],
  );
  assert.deepEqual(
    ytDlpJsRuntimeArgs({ execPath: "/usr/bin/node", nodeVersion: "unknown" }),
    [],
  );
});
