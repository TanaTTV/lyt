import test from "node:test";
import assert from "node:assert/strict";
import {
  doctorCapabilities,
  doctorCommandSucceeded,
} from "../src/doctor.js";

test("optional capability failures do not make core diagnostics fail", () => {
  const checks = [
    { name: "node", required: true, ok: true },
    { name: "yt-dlp", required: true, ok: true },
    { name: "ffmpeg", required: false, ok: false },
  ];

  assert.equal(doctorCommandSucceeded(checks), true);
});

test("a requested yt-dlp update failure makes the doctor command fail", () => {
  const checks = [
    { name: "node", required: true, ok: true },
    { name: "yt-dlp", required: true, ok: true },
    { name: "yt-dlp-update", required: false, ok: false },
  ];

  assert.equal(doctorCommandSucceeded(checks, { update: true }), false);
});

test("reports receipt hashing independently from optional ffprobe metadata", () => {
  assert.deepEqual(doctorCapabilities({
    nodeOk: true,
    ytDlp: "yt-dlp",
    ffmpeg: null,
    ffprobe: null,
    clipboard: null,
  }), {
    nativeAudio: true,
    mp3: false,
    video: false,
    clips: false,
    clipboard: false,
    artifactReceipts: true,
    artifactHashes: true,
    mediaInspection: false,
  });
});

test("reports ffprobe-backed media inspection when available", () => {
  const capabilities = doctorCapabilities({
    nodeOk: true,
    ytDlp: "yt-dlp",
    ffmpeg: "ffmpeg",
    ffprobe: "ffprobe",
    clipboard: ["clip"],
  });

  assert.equal(capabilities.mediaInspection, true);
  assert.equal(capabilities.artifactReceipts, true);
  assert.equal(capabilities.mp3, true);
});
