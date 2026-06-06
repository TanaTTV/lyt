import test from "node:test";
import assert from "node:assert/strict";
import { suggestAuthHint, warnIfYtDlpStale } from "../src/cli.js";

test("warnIfYtDlpStale warns on old yt-dlp versions", () => {
  const written = [];
  const out = { write: (chunk) => written.push(chunk) };

  warnIfYtDlpStale("2024.03.10", { out });
  assert.match(written.join(""), /outdated/);

  written.length = 0;
  warnIfYtDlpStale("2025.01.01", { out });
  assert.equal(written.length, 0);
});

test("suggestAuthHint recommends browser cookies for sign-in errors", () => {
  assert.match(
    suggestAuthHint(["ERROR: Sign in to confirm your age"]),
    /--cookies-from-browser/,
  );
  assert.equal(suggestAuthHint(["ERROR: Video unavailable"]), "");
});
