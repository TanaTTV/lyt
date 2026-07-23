import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSchema(name) {
  return JSON.parse(
    readFileSync(new URL(`../schemas/${name}.schema.json`, import.meta.url), "utf8"),
  );
}

test("the packaged result schema describes lyt.result.v1", () => {
  const schema = readSchema("lyt.result.v1");
  assert.equal(schema.properties.schema.const, "lyt.result.v1");
  assert.ok(schema.required.includes("results"));
  assert.ok(schema.properties.command.enum.includes("download"));
  assert.ok(schema.properties.results.items.properties.status.enum.includes("partial"));
  assert.ok(schema.properties.results.items.properties.reason.enum.includes("post-download"));
});

test("the packaged doctor schema describes capability diagnostics", () => {
  const schema = readSchema("lyt.doctor.v1");
  assert.equal(schema.properties.schema.const, "lyt.doctor.v1");
  assert.equal(schema.properties.command.const, "doctor");
  assert.ok(schema.required.includes("capabilities"));
  assert.ok(schema.properties.capabilities.required.includes("nativeAudio"));
});

test("the packaged history schema describes list and clear results", () => {
  const schema = readSchema("lyt.history.v1");
  assert.equal(schema.properties.schema.const, "lyt.history.v1");
  assert.deepEqual(schema.properties.command.enum, ["history.list", "history.clear"]);
  assert.ok(schema.required.includes("path"));
});

test("the packaged job event schema describes ordered JSONL lifecycle events", () => {
  const schema = readSchema("lyt.job-event.v1");
  assert.equal(schema.properties.schema.const, "lyt.job-event.v1");
  assert.ok(schema.required.includes("jobId"));
  assert.ok(schema.required.includes("sequence"));
  assert.ok(schema.properties.type.enum.includes("progress"));
  assert.ok(schema.properties.type.enum.includes("canceled"));
});

test("the packaged artifact schemas limit claims to local integrity", () => {
  const receipt = readSchema("lyt.artifact-receipt.v1");
  const verification = readSchema("lyt.artifact-verification.v1");

  assert.equal(receipt.properties.schema.const, "lyt.artifact-receipt.v1");
  assert.equal(
    receipt.properties.assurance.properties.remoteAuthenticityVerified.const,
    false,
  );
  assert.equal(
    verification.properties.assurance.properties.scope.const,
    "local-file-integrity-only",
  );
});
