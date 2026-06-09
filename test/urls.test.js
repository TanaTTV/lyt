import test from "node:test";
import assert from "node:assert/strict";
import { extractVideoId, extractYouTubeUrls } from "../src/urls.js";

test("extracts watch, short-link, shorts, live, and playlist URLs from text", () => {
  const text = `
    check this https://www.youtube.com/watch?v=dQw4w9WgXcQ and also
    https://youtu.be/aaaaaaaaaaa plus a short https://youtube.com/shorts/bbbbbbbbbbb
    live: https://www.youtube.com/live/ccccccccccc
    list: https://www.youtube.com/playlist?list=PLxyz_123
  `;

  const urls = extractYouTubeUrls(text);

  assert.equal(urls.length, 5);
  assert.ok(urls[0].includes("watch?v=dQw4w9WgXcQ"));
  assert.ok(urls[1].includes("youtu.be/aaaaaaaaaaa"));
  assert.ok(urls[2].includes("shorts/bbbbbbbbbbb"));
  assert.ok(urls[3].includes("live/ccccccccccc"));
  assert.ok(urls[4].includes("playlist?list=PLxyz_123"));
});

test("dedupes the same video shared via different URL shapes", () => {
  const text =
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ " +
    "https://youtu.be/dQw4w9WgXcQ " +
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ";

  assert.equal(extractYouTubeUrls(text).length, 1);
});

test("strips trailing punctuation from pasted links", () => {
  const urls = extractYouTubeUrls(
    "see (https://youtu.be/dQw4w9WgXcQ), cool right?",
  );

  assert.deepEqual(urls, ["https://youtu.be/dQw4w9WgXcQ"]);
});

test("ignores non-YouTube URLs and plain text", () => {
  assert.deepEqual(extractYouTubeUrls("https://example.com/watch?v=x hello"), []);
  assert.deepEqual(extractYouTubeUrls(""), []);
  assert.deepEqual(extractYouTubeUrls(null), []);
});

test("extractVideoId handles all common URL shapes", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=10",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ",
  ]) {
    assert.equal(extractVideoId(url), "dQw4w9WgXcQ", url);
  }
});

test("extractVideoId returns null when there is no video id", () => {
  assert.equal(extractVideoId("https://www.youtube.com/playlist?list=PL123"), null);
  assert.equal(extractVideoId("not a url"), null);
  assert.equal(extractVideoId(null), null);
});
