import test from "node:test";
import assert from "node:assert/strict";
import { parseDestinationLine } from "../src/cli.js";
import { buildYtDlpArgs, normalizeOptions, parseArgs } from "../src/ytDlp.js";

test("--json sets json option", () => {
  assert.equal(parseArgs(["--json", "u"]).options.json, true);
});

test("json mode uses --no-progress instead of --progress", () => {
  const args = buildYtDlpArgs("u", normalizeOptions({ json: true }));

  assert.ok(args.includes("--no-progress"));
  assert.equal(args.includes("--progress"), false);
});

test("parseDestinationLine extracts paths from yt-dlp output", () => {
  assert.equal(
    parseDestinationLine("[download] Destination: downloads/Song [abc].m4a"),
    "downloads/Song [abc].m4a",
  );
  assert.equal(
    parseDestinationLine("[ExtractAudio] Destination: downloads/Song [abc].mp3"),
    "downloads/Song [abc].mp3",
  );
  assert.equal(
    parseDestinationLine('[Merger] Merging formats into "clips/Video [xyz].mp4"'),
    "clips/Video [xyz].mp4",
  );
  assert.equal(parseDestinationLine("[info] Downloading webpage"), null);
});
