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
    ["Sign in to confirm your age", "authentication_required", false],
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
