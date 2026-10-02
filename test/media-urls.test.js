import test from "node:test";
import assert from "node:assert/strict";
import {
  dedupeUrlList,
  describeCollectionUrl,
  extractMediaUrls,
  normalizeUrl,
  urlKey,
} from "../src/urls.js";

test("extracts links from every supported host in the order they appear", () => {
  const text = [
    "first https://soundcloud.com/forss/flickermood?si=abc,",
    "then (https://youtu.be/dQw4w9WgXcQ)",
    "spotify https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg.",
    "vimeo https://vimeo.com/76979871 and bandcamp https://artist.bandcamp.com/track/song-name",
    "short https://on.soundcloud.com/AbCdE",
    "ignored https://example.com/article",
  ].join("\n");

  assert.deepEqual(extractMediaUrls(text), [
    "https://soundcloud.com/forss/flickermood?si=abc",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg",
    "https://vimeo.com/76979871",
    "https://artist.bandcamp.com/track/song-name",
    "https://on.soundcloud.com/AbCdE",
  ]);
  assert.deepEqual(extractMediaUrls(""), []);
});

test("normalizes links for comparison without changing what they point to", () => {
  assert.equal(
    normalizeUrl("https://M.SoundCloud.com/forss/flickermood/?si=xyz&utm_source=clipboard#t=10"),
    "https://soundcloud.com/forss/flickermood",
  );
  assert.equal(normalizeUrl("https://vimeo.com/123?b=2&a=1"), "https://vimeo.com/123?a=1&b=2");
  assert.equal(normalizeUrl("ytsearch1:Artist - Song audio"), "ytsearch1:Artist - Song audio");
  assert.equal(normalizeUrl("not a url"), "not a url");
});

test("keys use the YouTube ID when present and the normalized URL otherwise", () => {
  assert.equal(urlKey("https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=1"), "youtube:dQw4w9WgXcQ");
  assert.equal(urlKey("https://youtu.be/dQw4w9WgXcQ"), "youtube:dQw4w9WgXcQ");
  assert.equal(urlKey("https://soundcloud.com/a/b?in=a/sets/c"), "https://soundcloud.com/a/b");
  assert.deepEqual(
    dedupeUrlList(["https://soundcloud.com/a/b", "https://soundcloud.com/a/b?si=1", "https://soundcloud.com/a/c"]),
    ["https://soundcloud.com/a/b", "https://soundcloud.com/a/c"],
  );
});

test("recognizes playlist, channel, set, and profile links", () => {
  const collections = {
    "https://www.youtube.com/playlist?list=PL123": "a YouTube playlist",
    "https://music.youtube.com/playlist?list=OLAK5uy": "a YouTube playlist",
    "https://www.youtube.com/@SomeChannel": "a YouTube channel",
    "https://www.youtube.com/@SomeChannel/videos": "a YouTube channel",
    "https://www.youtube.com/channel/UCBR8-60-B28hp2BmDPdntcQ": "a YouTube channel",
    "https://soundcloud.com/forss": "a SoundCloud profile",
    "https://soundcloud.com/forss/sets/soulhack": "a SoundCloud set",
    "https://soundcloud.com/forss/likes": "a SoundCloud profile",
    "https://soundcloud.com/discover/sets/charts-top:all-music": "a SoundCloud set",
    "https://artist.bandcamp.com/album/record": "a Bandcamp album",
    "https://artist.bandcamp.com/": "a Bandcamp profile",
    "https://vimeo.com/showcase/12345": "a Vimeo collection",
    "ytsearch5:some song": "a search with several results",
  };

  for (const [url, kind] of Object.entries(collections)) {
    assert.equal(describeCollectionUrl(url), kind, url);
  }
});

test("single items are not collections", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://soundcloud.com/forss/flickermood",
    "https://soundcloud.com/discover",
    "https://artist.bandcamp.com/track/song",
    "https://vimeo.com/76979871",
    "https://vimeo.com/showcase/12345/video/76979871",
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "ytsearch1:some song",
    "https://example.com/video.mp4",
    "not a url",
  ]) {
    assert.equal(describeCollectionUrl(url), null, url);
  }
});
