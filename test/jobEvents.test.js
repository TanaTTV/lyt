import test from "node:test";
import assert from "node:assert/strict";
import {
  JOB_EVENT_SCHEMA,
  createJobEventWriter,
  jobEvent,
  parseJobEvent,
} from "../src/jobEvents.js";

test("job events use a stable versioned envelope", () => {
  assert.deepEqual(jobEvent({
    jobId: "job-1",
    sequence: 1,
    type: "started",
    version: "0.8.0",
    timestamp: "2026-07-23T00:00:00.000Z",
    url: "https://example.test/video",
    data: { attempt: 1 },
  }), {
    schema: JOB_EVENT_SCHEMA,
    version: "0.8.0",
    jobId: "job-1",
    sequence: 1,
    timestamp: "2026-07-23T00:00:00.000Z",
    type: "started",
    url: "https://example.test/video",
    data: { attempt: 1 },
  });
});

test("writer emits ordered JSONL and parser accepts it", () => {
  const chunks = [];
  const writer = createJobEventWriter({
    out: { write: (chunk) => chunks.push(chunk) },
    version: "0.8.0",
    jobId: "job-fixed",
    now: () => "2026-07-23T00:00:00.000Z",
  });

  writer.emit("queued", { url: "https://example.test/video" });
  writer.emit("progress", { url: "https://example.test/video", percent: 42 });

  assert.equal(chunks.length, 2);
  assert.equal(chunks.every((chunk) => chunk.endsWith("\n")), true);
  assert.equal(parseJobEvent(chunks[0]).sequence, 1);
  assert.deepEqual(parseJobEvent(chunks[1]).data, { percent: 42 });
});

test("job event validation rejects invalid identifiers and event types", () => {
  assert.throws(
    () => jobEvent({ jobId: "", sequence: 1, type: "started", version: "0.8.0" }),
    /jobId/,
  );
  assert.throws(
    () => jobEvent({ jobId: "job", sequence: 0, type: "started", version: "0.8.0" }),
    /sequence/,
  );
  assert.throws(
    () => jobEvent({ jobId: "job", sequence: 1, type: "unknown", version: "0.8.0" }),
    /Unknown job event/,
  );
});
