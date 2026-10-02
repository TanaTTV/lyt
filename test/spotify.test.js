import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTasks } from "../src/download.js";
import {
  EMBED_TRACK_LIMIT,
  expandSpotifyUrls,
  fetchSpotifyTracks,
  isSpotifyUrl,
  parseEmbedHtml,
  parseSpotifyUrl,
  safeName,
  spotifyCredentials,
  spotifyTargets,
  writePlaylistFile,
} from "../src/spotify.js";
import { normalizeOptions } from "../src/ytDlp.js";

const PLAYLIST = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc";
const COVER = "https://image-cdn.example/cover-640.jpg";

function embedHtml(entity) {
  const data = { props: { pageProps: { state: { data: { entity } } } } };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
}

const playlistEntity = {
  name: "Road: Trip 100%",
  visualIdentity: { image: [{ url: "https://x/64.jpg", maxWidth: 64 }, { url: COVER, maxWidth: 640 }] },
  trackList: [
    { uri: "spotify:track:6OmhkSOpvYBokMKQxpIGx2", title: "First Song", subtitle: "Artist A", duration: 200000, entityType: "track" },
    { uri: "spotify:track:11hcBLPtbMp4aQI6zGQLub", title: "Why/Not?", subtitle: "Artist B, Artist C", duration: 0, entityType: "track" },
    { title: "Some Episode", subtitle: "Pod", entityType: "episode" },
  ],
};

const fakeFetch = async (url) => {
  assert.equal(url, "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M");
  return { ok: true, status: 200, text: async () => embedHtml(playlistEntity) };
};

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "lyt-spotify-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("recognizes Spotify playlist, album, track, artist, intl, and embed links", () => {
  assert.deepEqual(parseSpotifyUrl(PLAYLIST), { type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" });
  assert.equal(parseSpotifyUrl("https://open.spotify.com/intl-de/album/1NAmidJlEaVgA3MpcPFYGq").type, "album");
  assert.equal(parseSpotifyUrl("https://open.spotify.com/embed/track/70cHKK8bHAfJrOGVnfRG9J").type, "track");
  assert.equal(parseSpotifyUrl("https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg").type, "artist");
  assert.equal(isSpotifyUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
  assert.equal(isSpotifyUrl("https://open.spotify.com/show/37i9dQZF1DXcBWIGoYBM5M"), false);
});

test("parses tracks, lengths, IDs, and the largest cover from the embed page", () => {
  const collection = parseEmbedHtml(embedHtml(playlistEntity), "playlist");
  assert.equal(collection.name, "Road: Trip 100%");
  assert.equal(collection.coverUrl, COVER);
  assert.equal(collection.truncated, false);
  assert.deepEqual(collection.tracks, [
    { title: "First Song", artist: "Artist A", durationMs: 200000, id: "6OmhkSOpvYBokMKQxpIGx2" },
    { title: "Why/Not?", artist: "Artist B, Artist C", durationMs: null, id: "11hcBLPtbMp4aQI6zGQLub" },
  ]);
  assert.throws(() => parseEmbedHtml("<html></html>"), /Could not read the Spotify track list/);
});

test("flags playlists cut off at the public embed limit", () => {
  const trackList = Array.from({ length: EMBED_TRACK_LIMIT }, (_, index) => ({ title: `Song ${index}`, subtitle: "A" }));
  assert.equal(parseEmbedHtml(embedHtml({ name: "Big", trackList }), "playlist").truncated, true);
  assert.equal(parseEmbedHtml(embedHtml({ name: "Big", trackList }), "album").truncated, false);
});

test("builds numbered targets with a length filter, fallback, and tags", () => {
  const targets = spotifyTargets(parseEmbedHtml(embedHtml(playlistEntity), "playlist"));
  const [first, second] = targets;

  assert.equal(first.url, "ytsearch5:Artist A - First Song audio");
  assert.equal(first.fallbackUrl, "ytsearch1:Artist A - First Song audio");
  assert.equal(first.matchFilter, "duration >? 188 & duration <? 212");
  assert.equal(first.base, "Road Trip 100%/01 - Artist A - First Song");
  assert.deepEqual(first.metadata, { artist: "Artist A", title: "First Song", album: null, track: null });
  // Playlist covers are not song covers; the song's own cover is looked up.
  assert.equal(first.cover, null);
  assert.equal(first.spotifyTrackId, "6OmhkSOpvYBokMKQxpIGx2");

  // Unknown length: plain top result, no filter.
  assert.equal(second.url, "ytsearch1:Artist B, Artist C - Why/Not? audio");
  assert.equal(second.matchFilter, null);
  assert.equal(second.template, "Road Trip 100%%/02 - Artist B, Artist C - WhyNot.%(ext)s");

  assert.equal(safeName('  a<b>:"c"  . '), "abc");
  assert.equal(safeName("///"), "Untitled");
});

test("albums tag the album and track number and use the album cover", () => {
  const [target] = spotifyTargets({
    name: "Album X",
    type: "album",
    coverUrl: COVER,
    tracks: [{ title: "Intro", artist: "Band", durationMs: 60000 }],
  });
  assert.deepEqual(target.metadata, { artist: "Band", title: "Intro", album: "Album X", track: 1 });
  assert.equal(target.cover, COVER);
});

test("single tracks skip the folder and number; duplicate songs are kept once", () => {
  const [target] = spotifyTargets({ name: "x", type: "track", tracks: [{ title: "Solo", artist: "Me" }] });
  assert.equal(target.template, "Me - Solo.%(ext)s");

  const dupes = spotifyTargets({
    name: "P",
    type: "playlist",
    tracks: [{ title: "Same", artist: "A" }, { title: "Same", artist: "A" }],
  });
  assert.equal(dupes.length, 1);
});

test("expands Spotify links, keeps other URLs, and skips songs already on disk", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const options = normalizeOptions({ mp3: true, outputDir: dir });
    mkdirSync(join(dir, "Road Trip 100%"));
    writeFileSync(join(dir, "Road Trip 100%", "01 - Artist A - First Song.mp3"), "");

    const { items, skipped, collections } = await expandSpotifyUrls(
      ["https://youtu.be/dQw4w9WgXcQ", PLAYLIST],
      options,
      { fetchImpl: fakeFetch, log: () => {} },
    );

    assert.equal(items[0], "https://youtu.be/dQw4w9WgXcQ");
    assert.equal(items[1].url, "ytsearch1:Artist B, Artist C - Why/Not? audio");
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].file, join(dir, "Road Trip 100%", "01 - Artist A - First Song.mp3"));
    assert.equal(collections[0].targets.length, 2);

    const tasks = buildTasks(items, options, { ffmpegPath: null }, { capturePaths: false });
    const outputOf = (task) => task.args[task.args.indexOf("-o") + 1];
    assert.equal(outputOf(tasks[0]), join(dir, "%(title).180B [%(id)s].%(ext)s"));
    assert.equal(outputOf(tasks[1]), join(dir, "Road Trip 100%%/02 - Artist B, Artist C - WhyNot.%(ext)s"));
    assert.equal(tasks[1].args.at(-1), "ytsearch1:Artist B, Artist C - Why/Not? audio");
    assert.ok(tasks[1].args.includes("--embed-metadata"));
    assert.ok(tasks[1].args.includes("@Why/Not?:^@(?P<meta_title>.+)$"));
    assert.ok(!tasks[1].args.includes("--embed-thumbnail"));
  } finally {
    cleanup();
  }
});

test("songs saved under an older number are not downloaded again", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const folder = join(dir, "Road Trip 100%");
    mkdirSync(folder);
    // The playlist gained a song at the top since the last run.
    writeFileSync(join(folder, "07 - Artist A - First Song.mp3"), "");
    const { items, skipped } = await expandSpotifyUrls([PLAYLIST], normalizeOptions({ mp3: true, outputDir: dir }), {
      fetchImpl: fakeFetch,
      log: () => {},
    });
    assert.equal(items.length, 1);
    assert.equal(skipped[0].file, join(folder, "07 - Artist A - First Song.mp3"));
    // Without --sync nothing on disk changes.
    assert.ok(existsSync(join(folder, "07 - Artist A - First Song.mp3")));
  } finally {
    cleanup();
  }
});

test("--sync renumbers songs and moves removed ones aside", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const folder = join(dir, "Road Trip 100%");
    mkdirSync(folder);
    writeFileSync(join(folder, "02 - Artist A - First Song.mp3"), "a");
    writeFileSync(join(folder, "01 - Artist B, Artist C - WhyNot.mp3"), "b");
    writeFileSync(join(folder, "03 - Gone - Song.mp3"), "c");
    writeFileSync(join(folder, "notes.txt"), "keep");

    const { items, skipped, warnings } = await expandSpotifyUrls(
      [PLAYLIST],
      normalizeOptions({ mp3: true, outputDir: dir, sync: true }),
      { fetchImpl: fakeFetch, log: () => {} },
    );

    assert.equal(items.length, 0);
    assert.deepEqual(readdirSync(folder).sort(), [
      "01 - Artist A - First Song.mp3",
      "02 - Artist B, Artist C - WhyNot.mp3",
      "notes.txt",
      "removed",
    ]);
    assert.equal(readFileSync(join(folder, "01 - Artist A - First Song.mp3"), "utf8"), "a");
    assert.deepEqual(readdirSync(join(folder, "removed")), ["03 - Gone - Song.mp3"]);
    assert.equal(skipped[0].file, join(folder, "01 - Artist A - First Song.mp3"));
    assert.match(warnings[0], /Moved 1 song/);
  } finally {
    cleanup();
  }
});

test("--sync with --dry-run changes nothing on disk", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const folder = join(dir, "Road Trip 100%");
    mkdirSync(folder);
    writeFileSync(join(folder, "05 - Artist A - First Song.mp3"), "");
    writeFileSync(join(folder, "03 - Gone - Song.mp3"), "");
    const { warnings } = await expandSpotifyUrls(
      [PLAYLIST],
      normalizeOptions({ mp3: true, outputDir: dir, sync: true, dryRun: true }),
      { fetchImpl: fakeFetch, log: () => {} },
    );
    assert.deepEqual(readdirSync(folder).sort(), ["03 - Gone - Song.mp3", "05 - Artist A - First Song.mp3"]);
    assert.match(warnings[0], /Would move 1 song/);
  } finally {
    cleanup();
  }
});

test("--force-overwrite re-queues songs that already exist", async () => {
  const { dir, cleanup } = tempDir();
  try {
    mkdirSync(join(dir, "Road Trip 100%"));
    writeFileSync(join(dir, "Road Trip 100%", "01 - Artist A - First Song.mp3"), "");
    const options = normalizeOptions({ mp3: true, forceOverwrite: true, outputDir: dir });
    const { items } = await expandSpotifyUrls([PLAYLIST], options, { fetchImpl: fakeFetch, log: () => {} });
    assert.equal(items.length, 2);
  } finally {
    cleanup();
  }
});

test("writes an ordered .m3u8 playlist with relative paths", () => {
  const { dir, cleanup } = tempDir();
  try {
    const folder = join(dir, "Mix");
    mkdirSync(folder);
    const targets = spotifyTargets({
      name: "Mix",
      type: "playlist",
      tracks: [{ title: "One", artist: "A", durationMs: 61000 }, { title: "Two", artist: "B" }],
    });
    const files = new Map([[targets[0], join(folder, "01 - A - One.mp3")], [targets[1], join(folder, "02 - B - Two.mp3")]]);
    const path = writePlaylistFile({ name: "Mix", type: "playlist", folder, targets }, (target) => files.get(target));

    assert.equal(path, join(folder, "Mix.m3u8"));
    assert.equal(
      readFileSync(path, "utf8"),
      "#EXTM3U\n#EXTINF:61,A - One\n01 - A - One.mp3\n#EXTINF:-1,B - Two\n02 - B - Two.mp3\n",
    );
    assert.equal(writePlaylistFile({ name: "x", type: "track", folder, targets }, () => "f"), null);
  } finally {
    cleanup();
  }
});

test("reports a clear error for private or missing playlists", async () => {
  await assert.rejects(
    expandSpotifyUrls([PLAYLIST], normalizeOptions({}), {
      fetchImpl: async () => ({ ok: false, status: 404 }),
      log: () => {},
    }),
    /HTTP 404 .* Is the playlist public\?/,
  );
});

test("uses the Web API with credentials and pages through every track", async () => {
  const calls = [];
  const apiFetch = async (url) => {
    calls.push(url);
    if (url.startsWith("https://accounts.spotify.com")) {
      return { ok: true, json: async () => ({ access_token: "token" }) };
    }
    const track = (n) => ({ track: { id: `id${n}`, name: `Song ${n}`, type: "track", duration_ms: 1000 * n, track_number: n, artists: [{ name: "A" }], album: { name: "Alb", images: [{ url: "big", width: 640 }] } } });
    if (url.includes("/playlists/") && !url.includes("offset")) {
      return { ok: true, json: async () => ({ name: "Long", images: [], tracks: { items: [track(1)], next: "https://api.spotify.com/v1/playlists/x/tracks?offset=1&limit=100" } }) };
    }
    return { ok: true, json: async () => ({ items: [track(2)], next: null }) };
  };

  const collection = await fetchSpotifyTracks(PLAYLIST, {
    fetchImpl: apiFetch,
    credentials: { clientId: "id", clientSecret: "secret" },
  });
  assert.equal(collection.name, "Long");
  assert.deepEqual(collection.tracks.map((track) => track.title), ["Song 1", "Song 2"]);
  assert.equal(collection.tracks[1].album, "Alb");
  assert.equal(collection.tracks[1].coverUrl, "big");
  assert.equal(calls.length, 3);
});

test("falls back to the public list when the Web API refuses", async () => {
  const logs = [];
  const collection = await fetchSpotifyTracks(PLAYLIST, {
    fetchImpl: async (url) => (url.includes("accounts.spotify.com")
      ? { ok: false, status: 400 }
      : { ok: true, text: async () => embedHtml(playlistEntity) }),
    credentials: { clientId: "id", clientSecret: "bad" },
    log: (line) => logs.push(line),
  });
  assert.equal(collection.tracks.length, 2);
  assert.match(logs[0], /Spotify API unavailable/);
});

test("credentials come from the environment or config", () => {
  assert.equal(spotifyCredentials({}, {}), null);
  assert.deepEqual(
    spotifyCredentials({ "spotify-client-id": "a", "spotify-client-secret": "b" }, {}),
    { clientId: "a", clientSecret: "b" },
  );
  assert.deepEqual(
    spotifyCredentials({}, { LYT_SPOTIFY_CLIENT_ID: "x", LYT_SPOTIFY_CLIENT_SECRET: "y" }),
    { clientId: "x", clientSecret: "y" },
  );
});
