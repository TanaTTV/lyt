import test from "node:test";
import assert from "node:assert/strict";
import { errorDetails } from "../src/result.js";
import { taggedError } from "../src/failures.js";

test("actionable failures preserve integer exit codes and distinguish setup from missing tools", () => {
  const error = taggedError("setup error", "setup_failed", { exitCode: 127 });
  assert.equal(errorDetails(error).code, 127);
  assert.equal(errorDetails(error).kind, "setup_failed");
  assert.equal(errorDetails(Object.assign(new Error("missing"), { exitCode: 127 })).kind, "tool_missing");
  assert.equal(errorDetails(Object.assign(new Error("bad arguments"), { exitCode: 2 })).kind, "usage");
});

test("remote failures offer bounded recovery without treating every 403 as login", () => {
  for (const [message, kind, retryable] of [
    ["HTTP Error 403: Forbidden", "access_denied", false],
    ["Sign in to confirm your age", "age_restricted", false],
    ["Private video. Sign in if you have been granted access", "authentication_required", false],
    ["HTTP Error 429", "rate_limited", true],
    ["HTTP Error 503", "network", true],
    ["Video unavailable", "media_unavailable", false],
    ["Requested format is not available", "format_unavailable", false],
    ["Unsupported URL", "unsupported_url", false],
    ["Unfamiliar upstream response", "unknown", false],
  ]) {
    const details = errorDetails(new Error(message));
    assert.equal(details.kind, kind); assert.equal(details.retryable, retryable); assert.ok(details.suggestion);
  }
});

test("tool diagnostics take precedence over URL text and filesystem codes are actionable", () => {
  const error = Object.assign(new Error("failed URL https://example.com/video-unavailable"), { diagnostic: "HTTP Error 429" });
  assert.equal(errorDetails(error).kind, "rate_limited");
  assert.equal(errorDetails(Object.assign(new Error("disk full"), { code: "ENOSPC" })).kind, "filesystem");
});

test("YouTube-specific failures map to the recovery an agent can act on", () => {
  for (const [diagnostic, kind] of [
    ["ERROR: [youtube] abc: Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication.", "bot_check"],
    ["WARNING: [youtube] nsig extraction failed: Some formats may be missing\nERROR: [youtube] abc: Requested format is not available", "tool_outdated"],
    ["ERROR: [youtube] abc: Join this channel to get access to members-only content like this video", "members_only"],
    ["ERROR: [youtube] abc: The uploader has not made this video available in your country", "geo_restricted"],
    ["ERROR: [youtube] abc: Premieres in 3 hours", "live_not_started"],
    ["ERROR: [youtube] abc: This video is DRM protected", "drm_protected"],
  ]) {
    assert.equal(errorDetails(Object.assign(new Error("yt-dlp failed"), { diagnostic })).kind, kind, diagnostic);
  }
});

test("errorLine strips yt-dlp bug-report boilerplate and keeps the cause", async () => {
  const { errorLine, summarizeToolFailure } = await import("../src/failures.js");
  const noisy = "[youtube] x: Downloading webpage\nERROR: [youtube] x: Unable to download API page: proxy refused (caused by ProxyError('x')); please report this issue on  https://github.com/yt-dlp/yt-dlp/issues?q= , filling out the appropriate issue template. Confirm you are on the latest version using  yt-dlp -U";
  assert.equal(errorLine(noisy), "ERROR: [youtube] x: Unable to download API page: proxy refused");
  assert.equal(summarizeToolFailure("Download failed", noisy), "Download failed: [youtube] x: Unable to download API page: proxy refused");
  assert.equal(errorLine("no errors here"), null);
});

test("JSON error details include a bounded diagnostic tail", () => {
  const diagnostic = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
  const details = errorDetails(Object.assign(new Error("x"), { diagnostic }));
  assert.ok(details.diagnostic.split("\n").length <= 12);
  assert.ok(details.diagnostic.endsWith("line 39"));
});
