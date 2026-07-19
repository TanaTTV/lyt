import test from "node:test";
import assert from "node:assert/strict";
import { doctorCommandSucceeded } from "../src/doctor.js";

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
