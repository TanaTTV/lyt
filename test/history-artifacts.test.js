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

test("exact variant is promoted for the coordinator's history report", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";
  const entries = [
    {
      id: "dQw4w9WgXcQ",
      artifact: "lyt.artifact.v1:audio",
      mode: "audio",
      files: ["C:/audio.m4a"],
    },
    {
      id: "dQw4w9WgXcQ",
      artifact: "lyt.artifact.v1:video",
      mode: "video",
      files: ["C:/video.mp4"],
    },
  ];

  withArtifact("lyt.artifact.v1:audio", () => {
    splitByHistory([url], entries, () => true);
  });

  assert.equal(entries.at(-1).artifact, "lyt.artifact.v1:audio");
  assert.deepEqual(entries.at(-1).files, ["C:/audio.m4a"]);
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

test("the coordinator can pass artifact identity without process-global state", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";
  const entries = [{
    id: "dQw4w9WgXcQ",
    artifact: "lyt.artifact.v1:audio",
    files: ["C:/audio.m4a"],
  }];

  assert.deepEqual(
    splitByHistory([url], entries, () => true, "lyt.artifact.v1:video"),
    { fresh: [url], skipped: [] },
  );

  const dir = mkdtempSync(join(tmpdir(), "lyt-explicit-artifact-"));
  const file = join(dir, "history.jsonl");
  try {
    recordDownload(
      { id: "dQw4w9WgXcQ", files: [] },
      file,
      { artifact: "lyt.artifact.v1:video" },
    );
    const entry = JSON.parse(readFileSync(file, "utf8").trim());
    assert.equal(entry.artifact, "lyt.artifact.v1:video");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
