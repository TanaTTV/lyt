import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordDownload, splitByHistory } from "../src/history.js";

function withArtifact(value, fn) {
  const previous = process.env.LYT_ARTIFACT_FINGERPRINT;
  process.env.LYT_ARTIFACT_FINGERPRINT = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.LYT_ARTIFACT_FINGERPRINT;
    else process.env.LYT_ARTIFACT_FINGERPRINT = previous;
  }
}

test("same source with a different artifact remains fresh", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";
  const entries = [{
    id: "dQw4w9WgXcQ",
    artifact: "lyt.artifact.v1:audio",
    files: ["C:/existing.m4a"],
  }];

  withArtifact("lyt.artifact.v1:video", () => {
    assert.deepEqual(splitByHistory([url], entries, () => true), {
      fresh: [url],
      skipped: [],
    });
  });

  withArtifact("lyt.artifact.v1:audio", () => {
    assert.deepEqual(splitByHistory([url], entries, () => true), {
      fresh: [],
      skipped: [url],
    });
  });
});

test("recordDownload persists the active artifact fingerprint", () => {
  const dir = mkdtempSync(join(tmpdir(), "lyt-artifact-history-"));
  const file = join(dir, "history.jsonl");

  try {
    withArtifact("lyt.artifact.v1:test", () => {
      recordDownload({ id: "dQw4w9WgXcQ", files: [] }, file);
    });
    const entry = JSON.parse(readFileSync(file, "utf8").trim());
    assert.equal(entry.artifact, "lyt.artifact.v1:test");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
