import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the packaged JSON schema describes lyt.result.v1", () => {
  const schema = JSON.parse(
    readFileSync(new URL("../schemas/lyt.result.v1.schema.json", import.meta.url), "utf8"),
  );

  assert.equal(schema.properties.schema.const, "lyt.result.v1");
  assert.ok(schema.required.includes("results"));
  assert.ok(schema.properties.command.enum.includes("download"));
});
