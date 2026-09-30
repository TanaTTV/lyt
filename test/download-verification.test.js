import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadUrls } from "../src/download.js";
import { normalizeOptions } from "../src/ytDlp.js";
import { buildArtifactFingerprint } from "../src/history.js";

const url = "https://www.youtube.com/watch?v=39XR4EXFz5Y";
const tools = { ytDlpCommand: "fake-tool", ffmpegPath: null };
const createOptions = (extra = {}) => normalizeOptions({ outputDir: mkdtempSync(join(tmpdir(), "lyt-download-test-")), json: true, history: false, ...extra });

test("success results include receipts and failed verification retains reported files", async () => {
  const options = createOptions();
  const file = join(options.outputDir, "final.mp3"); writeFileSync(file, "media");
  const success = await downloadUrls([url], options, tools, { execute: async () => ({ files: [file] }), ffprobePath: null });
  assert.equal(success.results[0].status, "downloaded");
  assert.equal(success.results[0].artifacts[0].sizeBytes, 5);
  const missing = join(options.outputDir, "missing.mp3");
  const failed = await downloadUrls([url], options, tools, { execute: async () => ({ files: [missing] }), ffprobePath: null });
  assert.equal(failed.failures.length, 1);
  assert.equal(failed.results[0].error.kind, "verification_failed");
  assert.deepEqual(failed.results[0].files, [missing]);
});

test("verification failure does not write success history", async () => {
  const options = createOptions({ history: true });
  let writes = 0;
  const result = await downloadUrls([url], options, tools, {
    execute: async () => ({ files: [join(options.outputDir, "missing.mp3")] }),
    readHistory: () => [], writeHistory: () => { writes++; }, ffprobePath: null,
  });
  assert.equal(writes, 0);
  assert.equal(result.results[0].status, "failed");
});

test("history skips remain skips with inspected receipts and no repeated execution", async () => {
  const options = createOptions({ history: true });
  const file = join(options.outputDir, "final.mp3"); writeFileSync(file, "media");
  let executions = 0;
  const result = await downloadUrls([url], options, tools, {
    execute: async () => { executions++; return { files: [file] }; },
    readHistory: () => [{ id: "39XR4EXFz5Y", artifact: buildArtifactFingerprint(options).fingerprint, mode: "audio", files: [file], dir: options.outputDir }], ffprobePath: null,
  });
  assert.equal(executions, 0);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].status, "skipped");
  assert.equal(result.results[0].artifacts[0].sizeBytes, 5);
});

test("a size flag alone does not misclassify an unexplained missing output", async () => {
  const options = createOptions({ maxFilesize: "1M" });
  const ordinary = await downloadUrls([url], options, tools, { execute: async () => ({ files: [] }), ffprobePath: null });
  assert.equal(ordinary.results[0].error.kind, "no_output");
  const limited = await downloadUrls([url], options, tools, { execute: async () => ({ files: [], sizeLimited: true }), ffprobePath: null });
  assert.equal(limited.results[0].error.kind, "size_limit");
  assert.equal(limited.results[0].status, "skipped");
});

test("history write failures produce one result with retained verified files", async () => {
  const options = createOptions({ history: true });
  const file = join(options.outputDir, "final.mp3"); writeFileSync(file, "media");
  const result = await downloadUrls([url], options, tools, {
    execute: async () => ({ files: [file] }), readHistory: () => [], ffprobePath: null,
    writeHistory: () => { throw Object.assign(new Error("disk full"), { code: "ENOSPC" }); },
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].error.kind, "filesystem");
  assert.equal(result.results[0].artifacts[0].sizeBytes, 5);
});
