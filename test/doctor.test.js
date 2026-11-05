import test from "node:test";
import assert from "node:assert/strict";
import { doctorCommandSucceeded, lytVersionCheck } from "../src/doctor.js";

test("optional capability failures do not make core diagnostics fail", () => {
  const checks = [
    { name: "node", required: true, ok: true },
    { name: "yt-dlp", required: true, ok: true },
    { name: "ffmpeg", required: false, ok: false },
  ];

  assert.equal(doctorCommandSucceeded(checks), true);
});

test("doctor respects cached checks, explicit refresh, disabled checks, and stale results", async () => {
  const previous = process.env.LYT_NO_UPDATE_CHECK;
  delete process.env.LYT_NO_UPDATE_CHECK;
  const previousCheck = process.env.LYT_UPDATE_CHECK;
  delete process.env.LYT_UPDATE_CHECK;
  try {
    const calls = [];
    const check = async ({ force }) => {
      calls.push(force);
      return { source: "stale-cache", latestVersion: "0.8.2", updateAvailable: true, installCommand: "upgrade" };
    };
    const stale = await lytVersionCheck({ config: {}, check });
    assert.match(stale.detail, /current registry status unknown/);
    assert.doesNotMatch(stale.detail, /up to date/);
    await lytVersionCheck({ config: {}, force: true, check });
    const disabled = await lytVersionCheck({ config: { "update-check": false }, check });
    assert.deepEqual(calls, [false, true]);
    assert.match(disabled.detail, /disabled/);
  } finally {
    if (previous === undefined) delete process.env.LYT_NO_UPDATE_CHECK;
    else process.env.LYT_NO_UPDATE_CHECK = previous;
    if (previousCheck === undefined) delete process.env.LYT_UPDATE_CHECK;
    else process.env.LYT_UPDATE_CHECK = previousCheck;
  }
});

test("a requested yt-dlp update failure makes the doctor command fail", () => {
  const checks = [
    { name: "node", required: true, ok: true },
    { name: "yt-dlp", required: true, ok: true },
    { name: "yt-dlp-update", required: false, ok: false },
  ];

  assert.equal(doctorCommandSucceeded(checks, { update: true }), false);
});

test("yt-dlp version dates turn into an age in days", async () => {
  const { ytDlpVersionAgeDays } = await import("../src/doctor.js");
  const now = Date.UTC(2026, 10, 5);
  assert.equal(ytDlpVersionAgeDays("2026.10.26", now), 10);
  assert.equal(ytDlpVersionAgeDays("2026.10.26.233100", now), 10);
  assert.equal(ytDlpVersionAgeDays("unknown", now), null);
  assert.equal(ytDlpVersionAgeDays(null, now), null);
});

test("yt-dlp freshness policy reads config strings and defaults to auto-update on stable", async () => {
  const { ytDlpPolicy } = await import("../src/bootstrap.js");
  assert.deepEqual(ytDlpPolicy({}), { autoUpdate: true, channel: "stable" });
  assert.deepEqual(ytDlpPolicy({ "yt-dlp-auto-update": "false", "yt-dlp-channel": "nightly" }), { autoUpdate: false, channel: "nightly" });
  assert.deepEqual(ytDlpPolicy({ "yt-dlp-channel": "weird" }).channel, "stable");
});
