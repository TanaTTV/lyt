import test from "node:test";
import assert from "node:assert/strict";
import { writeArtifactReceipts } from "../src/cli.js";

test("receipt failures preserve downloaded artifact paths and successful receipts", async () => {
  const writes = [];
  const result = await writeArtifactReceipts(
    ["C:/downloads/one.mp4", "C:/downloads/two.mp4"],
    {
      enabled: true,
      includeSha256: true,
      createReceipt: async (file) => {
        if (file.endsWith("two.mp4")) throw new Error("ffprobe failed");
        return { schema: "lyt.artifact-receipt.v1", artifact: { path: file } };
      },
      writeReceipt: async (...args) => writes.push(args),
    },
  );

  assert.deepEqual(result.receipts, [
    "C:/downloads/one.mp4.lyt-receipt.json",
  ]);
  assert.equal(
    result.receiptByArtifact.get("C:/downloads/one.mp4"),
    "C:/downloads/one.mp4.lyt-receipt.json",
  );
  assert.equal(result.receiptByArtifact.has("C:/downloads/two.mp4"), false);
  assert.deepEqual(result.errors, [{
    stage: "receipt",
    file: "C:/downloads/two.mp4",
    error: { message: "ffprobe failed", code: 1 },
  }]);
  assert.equal(writes[0][2].flag, "wx");
});

test("an existing valid receipt is reused idempotently", async () => {
  const collision = new Error("already exists");
  collision.code = "EEXIST";
  const result = await writeArtifactReceipts(
    ["C:/downloads/one.mp4"],
    {
      enabled: true,
      createReceipt: async () => ({ schema: "new" }),
      writeReceipt: async () => {
        throw collision;
      },
      readReceipt: async () => JSON.stringify({
        schema: "lyt.artifact-receipt.v1",
        artifact: { path: "C:/downloads/one.mp4", sizeBytes: 5, sha256: null },
      }),
      verifyReceipt: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result.receipts, [
    "C:/downloads/one.mp4.lyt-receipt.json",
  ]);
  assert.deepEqual(result.errors, []);
});

test("a size-only receipt is not reused when SHA-256 was requested", async () => {
  const collision = new Error("already exists");
  collision.code = "EEXIST";
  const result = await writeArtifactReceipts(
    ["C:/downloads/one.mp4"],
    {
      enabled: true,
      includeSha256: true,
      createReceipt: async () => ({ schema: "new" }),
      writeReceipt: async () => {
        throw collision;
      },
      readReceipt: async () => JSON.stringify({
        schema: "lyt.artifact-receipt.v1",
        artifact: { path: "C:/downloads/one.mp4", sizeBytes: 5, sha256: null },
      }),
      verifyReceipt: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result.receipts, []);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].error.message, /already exists/);
});
