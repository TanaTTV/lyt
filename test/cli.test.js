import test from "node:test";
import assert from "node:assert/strict";
import { suggestAuthHint } from "../src/cli.js";

test("suggestAuthHint recommends browser cookies for sign-in errors", () => {
  assert.match(
    suggestAuthHint(["ERROR: Sign in to confirm your age"]),
    /--cookies-from-browser/,
  );
  assert.equal(suggestAuthHint(["ERROR: Video unavailable"]), "");
});

test("suggestAuthHint matches the gates yt-dlp actually reports", () => {
  for (const line of [
    "ERROR: Private video. Sign in if you've been granted access",
    "ERROR: Join this channel to get access to members-only content",
    "ERROR: This video is age-restricted",
  ]) {
    assert.match(suggestAuthHint([line]), /--cookies-from-browser/, line);
  }
});
