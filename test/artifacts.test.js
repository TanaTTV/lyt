import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectArtifact, inspectArtifacts, findFfprobe } from "../src/artifacts.js";
import { taggedError } from "../src/failures.js";

const root = mkdtempSync(join(tmpdir(), "lyt-artifact-test-"));
const media = join(root, "sample.mp3");
writeFileSync(media, "sample media bytes");
const probeData = {
  format: { format_name: "mp3", duration: "6.123" },
  streams: [{ codec_type: "audio", codec_name: "mp3", sample_rate: "48000", channels: 2 },
    { codec_type: "video", codec_name: "mjpeg", disposition: { attached_pic: 1 } }],
  program_version: { version: "test-version" },
};

test("receipts verify file existence and size without claiming ffprobe verification", async () => {
  const receipt = await inspectArtifact(media);
  assert.equal(receipt.sizeBytes, 18);
  assert.deepEqual(receipt.verification, { status: "file-only", reason: "ffprobe_missing" });
  await assert.rejects(inspectArtifact(join(root, "missing.mp3")), (error) => error.kind === "verification_failed");
  const empty = join(root, "empty.mp3"); writeFileSync(empty, "");
  await assert.rejects(inspectArtifact(empty), (error) => error.kind === "verification_failed");
  await assert.rejects(inspectArtifact(root), (error) => error.kind === "verification_failed");
});

test("ffprobe receipts shape numeric metadata, exclude cover art, and limit protocols", async () => {
  const receipt = await inspectArtifact(media, { ffprobePath: "trusted-ffprobe", mode: "audio", probe: async (_command, args, options) => {
    assert.deepEqual(args.slice(-2), ["-i", media]);
    assert.equal(args[args.indexOf("-protocol_whitelist") + 1], "file,pipe");
    assert.equal(options.timeoutMs, 10_000);
    return probeData;
  } });
  assert.equal(receipt.durationSeconds, 6.123);
  assert.equal(receipt.container, "mp3");
  assert.equal(receipt.streams.length, 1);
  assert.equal(receipt.streams[0].sampleRate, 48000);
  assert.equal(receipt.verification.status, "verified");
  assert.equal(receipt.verification.version, "test-version");
});

test("optional ffprobe timeouts degrade honestly; wrong stream types fail", async () => {
  const timeout = await inspectArtifact(media, { ffprobePath: "probe", probe: async () => { throw taggedError("timeout", "network"); } });
  assert.equal(timeout.verification.status, "file-only");
  assert.equal(timeout.verification.reason, "probe_timeout");
  await assert.rejects(inspectArtifact(media, { ffprobePath: "probe", mode: "video", probe: async () => probeData }), (error) => error.kind === "verification_failed");
  await assert.rejects(inspectArtifact(media, { ffprobePath: "probe", probe: async () => ({ streams: [] }) }), (error) => error.kind === "verification_failed");
});

test("multi-file inspection preserves all receipts when one file fails", async () => {
  await assert.rejects(inspectArtifacts([join(root, "missing.mp3"), media]), (error) => {
    assert.equal(error.artifacts.length, 2);
    assert.equal(error.artifacts[0].verification.status, "failed");
    assert.equal(error.artifacts[1].verification.status, "file-only");
    return true;
  });
});

test("ffprobe discovery uses absolute PATH resolution or a trusted ffmpeg sibling", () => {
  assert.equal(findFfprobe(null, () => null), null);
  assert.equal(findFfprobe(null, (value) => value === "ffprobe" ? "/trusted/ffprobe" : null), "/trusted/ffprobe");
  const lookedUp = [];
  findFfprobe(join(root, "ffmpeg"), (value) => { lookedUp.push(value); return null; });
  assert.equal(lookedUp[1], join(root, process.platform === "win32" ? "ffprobe.exe" : "ffprobe"));
});
