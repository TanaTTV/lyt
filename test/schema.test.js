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
