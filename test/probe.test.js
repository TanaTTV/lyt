import test from "node:test";
import assert from "node:assert/strict";
import {
  ARTIFACT_RECEIPT_SCHEMA,
  ARTIFACT_VERIFICATION_SCHEMA,
  createArtifactReceipt,
  inspectLocalArtifact,
  normalizeProbeResult,
  verifyArtifactReceipt,
} from "../src/probe.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

test("normalizes ffprobe containers, duration, and codecs deterministically", () => {
  assert.deepEqual(normalizeProbeResult({
    format: {
      format_name: "mov,mp4,m4a,3gp,3g2,mj2",
      duration: "12.500000",
    },
    streams: [
      { codec_type: "video", codec_name: "h264" },
      { codec_type: "audio", codec_name: "aac" },
      { codec_type: "video", codec_name: "h264" },
      { codec_type: "subtitle", codec_name: "mov_text" },
      { codec_type: "data", codec_name: "bin_data" },
    ],
  }), {
    container: {
      primary: "mov",
      formats: ["3g2", "3gp", "m4a", "mj2", "mov", "mp4"],
    },
    durationSeconds: 12.5,
    codecs: {
      audio: ["aac"],
      video: ["h264"],
      subtitle: ["mov_text"],
      other: ["bin_data"],
    },
  });
});

test("inspects a local artifact through an injected ffprobe runner", async () => {
  const calls = [];
  const media = await inspectLocalArtifact("movie.mp4", {
    ffprobePath: "ffprobe-test",
    runCommand: async (command, args) => {
      calls.push({ command, args });
      return {
        stdout: JSON.stringify({
          format: { format_name: "mp4", duration: "3" },
          streams: [{ codec_type: "video", codec_name: "av1" }],
        }),
        stderr: "",
      };
    },
  });

  assert.equal(calls[0].command, "ffprobe-test");
  assert.deepEqual(calls[0].args.slice(0, 4), [
    "-v",
    "error",
    "-show_entries",
    "format=format_name,duration:stream=codec_type,codec_name",
  ]);
  assert.equal(media.container.primary, "mp4");
  assert.deepEqual(media.codecs.video, ["av1"]);
});

test("creates a versioned SHA-256 receipt with media metadata and tool versions", async () => {
  const receipt = await createArtifactReceipt("movie.mp4", {
    includeSha256: true,
    ffprobePath: "ffprobe-test",
    toolPaths: { ffmpeg: "ffmpeg-test" },
    statFile: async () => ({ size: 42, isFile: () => true }),
    hashFile: async () => HASH_A,
    now: () => new Date("2026-07-23T12:00:00.000Z"),
    runCommand: async (command, args) => {
      if (args.includes("-of")) {
        return {
          stdout: JSON.stringify({
            format: { format_name: "matroska,webm", duration: "7.25" },
            streams: [
              { codec_type: "video", codec_name: "vp9" },
              { codec_type: "audio", codec_name: "opus" },
            ],
          }),
          stderr: "",
        };
      }
      return { stdout: `${command} version test-1\n`, stderr: "" };
    },
  });

  assert.equal(receipt.schema, ARTIFACT_RECEIPT_SCHEMA);
  assert.equal(receipt.createdAt, "2026-07-23T12:00:00.000Z");
  assert.equal(receipt.assurance.scope, "local-file-integrity-only");
  assert.equal(receipt.assurance.remoteAuthenticityVerified, false);
  assert.equal(receipt.assurance.strength, "sha256");
  assert.equal(receipt.artifact.sizeBytes, 42);
  assert.equal(receipt.artifact.sha256, HASH_A);
  assert.deepEqual(receipt.artifact.media.codecs, {
    audio: ["opus"],
    video: ["vp9"],
    subtitle: [],
    other: [],
  });
  assert.equal(receipt.inspection.available, true);
  assert.equal(receipt.tools.ffprobe.version, "ffprobe-test version test-1");
  assert.equal(receipt.tools.ffmpeg.version, "ffmpeg-test version test-1");
});

test("creates a size-only receipt when ffprobe is unavailable", async () => {
  const receipt = await createArtifactReceipt("audio.m4a", {
    statFile: async () => ({ size: 10, isFile: () => true }),
    locateFfprobe: async () => null,
    now: () => new Date("2026-07-23T12:00:00.000Z"),
  });

  assert.equal(receipt.assurance.strength, "size-only");
  assert.equal(receipt.artifact.sha256, null);
  assert.equal(receipt.artifact.media, null);
  assert.deepEqual(receipt.inspection, {
    available: false,
    error: "ffprobe unavailable",
  });
});

test("verifies local size and a recorded SHA-256 hash", async () => {
  const receipt = {
    schema: ARTIFACT_RECEIPT_SCHEMA,
    artifact: {
      path: "movie.mp4",
      sizeBytes: 42,
      sha256: HASH_A,
    },
  };

  const verification = await verifyArtifactReceipt(receipt, {
    statFile: async () => ({ size: 42, isFile: () => true }),
    hashFile: async () => HASH_A,
  });

  assert.equal(verification.schema, ARTIFACT_VERIFICATION_SCHEMA);
  assert.equal(verification.ok, true);
  assert.equal(verification.assurance.remoteAuthenticityVerified, false);
  assert.equal(verification.assurance.strength, "sha256");
  assert.deepEqual(verification.checks.map((check) => check.name), [
    "file",
    "size",
    "sha256",
  ]);
});

test("reports local hash mismatches without implying remote authenticity", async () => {
  const receipt = {
    schema: ARTIFACT_RECEIPT_SCHEMA,
    artifact: {
      path: "movie.mp4",
      sizeBytes: 42,
      sha256: HASH_A,
    },
  };

  const verification = await verifyArtifactReceipt(receipt, {
    statFile: async () => ({ size: 42, isFile: () => true }),
    hashFile: async () => HASH_B,
  });

  assert.equal(verification.ok, false);
  assert.equal(
    verification.checks.find((check) => check.name === "sha256").ok,
    false,
  );
  assert.equal(verification.assurance.scope, "local-file-integrity-only");
  assert.equal(verification.assurance.remoteAuthenticityVerified, false);
});

test("reports hash read failures inside the verification contract", async () => {
  const receipt = {
    schema: ARTIFACT_RECEIPT_SCHEMA,
    artifact: {
      path: "movie.mp4",
      sizeBytes: 42,
      sha256: HASH_A,
    },
  };

  const verification = await verifyArtifactReceipt(receipt, {
    statFile: async () => ({ size: 42, isFile: () => true }),
    hashFile: async () => {
      throw new Error("permission denied");
    },
  });

  assert.equal(verification.schema, ARTIFACT_VERIFICATION_SCHEMA);
  assert.equal(verification.ok, false);
  assert.match(
    verification.checks.find((check) => check.name === "sha256").detail,
    /permission denied/,
  );
});

test("size-only receipts disclose their weaker local verification", async () => {
  const receipt = {
    schema: ARTIFACT_RECEIPT_SCHEMA,
    artifact: {
      path: "audio.m4a",
      sizeBytes: 5,
      sha256: null,
    },
  };

  const verification = await verifyArtifactReceipt(receipt, {
    statFile: async () => ({ size: 5, isFile: () => true }),
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.assurance.strength, "size-only");
  assert.equal(
    verification.checks.find((check) => check.name === "sha256").ok,
    null,
  );
});

test("rejects malformed receipts before accessing the filesystem", async () => {
  await assert.rejects(
    verifyArtifactReceipt({ schema: "lyt.artifact-receipt.v0" }),
    /Unsupported artifact receipt schema/,
  );
  await assert.rejects(
    verifyArtifactReceipt({
      schema: ARTIFACT_RECEIPT_SCHEMA,
      artifact: { path: "file", sizeBytes: 1, sha256: HASH_A.toUpperCase() },
    }),
    /invalid artifact.sha256/,
  );
});
