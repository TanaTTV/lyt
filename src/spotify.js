// Spotify playlist/album/track/artist links → YouTube download targets.
//
// Spotify audio is DRM-protected, so lyt never downloads from Spotify. It only
// reads the public track list (title, artists, length, cover art), then asks
// yt-dlp to download the best YouTube match for each song and tags the file
// with the Spotify details.

import { mkdirSync, readdirSync, renameSync, existsSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import process from "node:process";

const SPOTIFY_PATTERN =
  /^https?:\/\/open\.spotify\.com\/(?:intl-[\w-]+\/)?(?:embed\/)?(playlist|album|track|artist)\/([A-Za-z0-9]{22})/;

// Spotify's public embed page lists at most this many tracks.
export const EMBED_TRACK_LIMIT = 100;

const FETCH_TIMEOUT_MS = 20_000;
const API_PAGE_LIMIT = 100;
const API_MAX_PAGES = 100;

const AUDIO_EXTENSIONS = ["mp3", "m4a", "opus", "webm", "ogg", "aac", "flac", "wav"];
const VIDEO_EXTENSIONS = ["mp4", "mkv", "webm"];

export function parseSpotifyUrl(url) {
  const match = SPOTIFY_PATTERN.exec(String(url ?? "").trim());
  return match ? { type: match[1], id: match[2] } : null;
}

export function isSpotifyUrl(url) {
  return parseSpotifyUrl(url) !== null;
}

// Reads the collection name, cover, and track list. Uses the Spotify Web API
// when credentials are configured (full playlists, album names, per-track
// covers); otherwise, or if the API refuses, the public embed page.
export async function fetchSpotifyTracks(url, {
  fetchImpl = globalThis.fetch,
  credentials = null,
  log = () => {},
} = {}) {
  const parsed = parseSpotifyUrl(url);
  if (!parsed) throw new Error(`Not a Spotify playlist, album, track, or artist URL: ${url}`);

  if (credentials?.clientId && credentials?.clientSecret && parsed.type !== "artist") {
    try {
      return await fetchFromApi(parsed, credentials, fetchImpl);
    } catch (error) {
      log(`Spotify API unavailable (${error.message}); using the public track list instead.`);
    }
  }

  const embedUrl = `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`;
  const response = await fetchImpl(embedUrl, {
    headers: { "user-agent": "Mozilla/5.0 (lyt)" },
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(
      `Spotify returned HTTP ${response.status} for ${embedUrl}. Is the ${parsed.type} public?`,
    );
  }

  return parseEmbedHtml(await response.text(), parsed.type);
}

export function parseEmbedHtml(html, type = "playlist") {
  const entity = embedEntity(html);

  if (!entity) {
    throw new Error("Could not read the Spotify track list (the embed page format may have changed).");
  }

  const list = type === "track"
    ? [{
        title: entity.title ?? entity.name,
        subtitle: artistNames(entity.artists) || entity.subtitle,
        duration: entity.duration,
        uri: entity.uri,
      }]
    : entity.trackList ?? [];

  const tracks = list
    .filter((item) => item?.title && (item.entityType ?? "track") === "track")
    .map((item) => ({
      title: String(item.title).trim(),
      artist: String(item.subtitle ?? "").replace(/\u00a0/g, " ").trim(),
      durationMs: Number.isFinite(item.duration) && item.duration > 0 ? item.duration : null,
      id: trackIdFromUri(item.uri),
    }));

  if (tracks.length === 0) {
    throw new Error("The Spotify link has no downloadable tracks.");
  }

  return {
    name: String(entity.name ?? entity.title ?? "Spotify").trim(),
    type,
    tracks,
    coverUrl: largestImage(entity.visualIdentity?.image ?? entity.coverArt?.sources),
    // Playlists and artist pages show a limited list publicly; albums and
    // single tracks are complete.
    truncated: type === "playlist" && tracks.length >= EMBED_TRACK_LIMIT,
  };
}

// The album cover of one track, read from its public embed page. Used for
// playlist songs, whose list does not include per-track artwork.
export async function fetchTrackCover(trackId, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(`https://open.spotify.com/embed/track/${trackId}`, {
    headers: { "user-agent": "Mozilla/5.0 (lyt)" },
    signal: timeoutSignal(),
  });
  if (!response.ok) return null;
  const entity = embedEntity(await response.text());
  return largestImage(entity?.visualIdentity?.image ?? entity?.coverArt?.sources);
}

// One yt-dlp target per song. When the Spotify length is known, lyt searches
// the top five YouTube results and takes the first whose length is within a
// few seconds, which skips music videos with intros and extended mixes; if
// none fit, it falls back to the top result. Filenames come from Spotify, and
// playlist/album tracks keep their Spotify order.
export function spotifyTargets(collection) {
  const folderName = collection.type === "track" ? "" : safeName(collection.name);
  const folder = folderName ? `${folderName}/` : "";
  const width = Math.max(2, String(collection.tracks.length).length);
  const seen = new Set();
  const targets = [];

  collection.tracks.forEach((track, index) => {
    const label = track.artist ? `${track.artist} - ${track.title}` : track.title;
    const key = labelKey(safeName(label));
    // A playlist can list the same song twice; keep the first position.
    if (seen.has(key)) return;
    seen.add(key);

    const number = collection.type === "track" ? "" : `${String(index + 1).padStart(width, "0")} - `;
    const base = `${folder}${number}${safeName(label)}`;
    const query = `${label} audio`;
    const durationSeconds = track.durationMs ? Math.round(track.durationMs / 1000) : null;
    const tolerance = durationSeconds ? Math.max(10, Math.round(durationSeconds * 0.06)) : null;

    targets.push({
      url: durationSeconds ? `ytsearch5:${query}` : `ytsearch1:${query}`,
      fallbackUrl: durationSeconds ? `ytsearch1:${query}` : null,
      matchFilter: durationSeconds
        ? `duration >? ${durationSeconds - tolerance} & duration <? ${durationSeconds + tolerance}`
        : null,
      label,
      base,
      folder: folderName,
      // Escape % so Spotify names stay literal inside the yt-dlp template.
      template: `${base.replaceAll("%", "%%")}.%(ext)s`,
      metadata: {
        artist: track.artist || null,
        title: track.title,
        album: track.album ?? (collection.type === "album" ? collection.name : null),
        track: track.trackNumber ?? (collection.type === "album" ? index + 1 : null),
      },
      cover: track.coverUrl ?? (["album", "track"].includes(collection.type) ? collection.coverUrl : null),
      spotifyTrackId: track.id ?? null,
      source: {
        type: "spotify",
        collection: collection.type === "track" ? null : collection.name,
        position: index + 1,
        artist: track.artist || null,
        title: track.title,
        durationSeconds,
      },
    });
  });

  return targets;
}

// Replaces Spotify links in a URL list with download targets. Plain URLs pass
// through unchanged. Songs whose file already exists are skipped (matched by
// "Artist - Title", so a playlist whose order changed is not re-downloaded).
// With options.sync, existing songs are renumbered to the current order and
// songs no longer in the playlist move to a "removed" folder.
export async function expandSpotifyUrls(
  urls,
  options,
  {
    fetchImpl = globalThis.fetch,
    listDir = listDirectory,
    move = moveFile,
    log = (line) => console.error(line),
    credentials = null,
  } = {},
) {
  const items = [];
  const skipped = [];
  const collections = [];
  const warnings = [];
  const changesAllowed = !options.dryRun;

  for (const url of urls) {
    if (!isSpotifyUrl(url)) {
      items.push(url);
      continue;
    }

    const collection = await fetchSpotifyTracks(url, { fetchImpl, credentials, log });
    const targets = spotifyTargets(collection);
    const folderDir = join(options.outputDir, targets[0]?.folder ?? "");
    const extensions = options.video ? VIDEO_EXTENSIONS : options.mp3 ? ["mp3"] : AUDIO_EXTENSIONS;
    const onDisk = indexExistingSongs(listDir(folderDir), extensions, collection.type !== "track");
    const claimed = new Set();
    let fresh = 0;

    if (collection.truncated) {
      const warning =
        `Spotify only lists the first ${EMBED_TRACK_LIMIT} songs of "${collection.name}" publicly. ` +
        "To get every song, set spotify-client-id and spotify-client-secret (see `lyt --help`).";
      warnings.push(warning);
      if (!options.json) log(warning);
    }

    const renames = [];

    for (const target of targets) {
      const key = labelKey(basename(target.base));
      const existing = onDisk.get(key);

      if (existing && !options.forceOverwrite) {
        claimed.add(key);
        const song = { ...target, file: join(folderDir, existing.name) };
        const wanted = join(options.outputDir, `${target.base}.${existing.ext}`);
        if (options.sync && resolve(song.file) !== resolve(wanted)) renames.push({ song, wanted });
        skipped.push(song);
        continue;
      }

      items.push(target);
      fresh += 1;
    }

    if (options.sync && collection.type !== "track") {
      const removed = [...onDisk.entries()].filter(([key, entry]) => !claimed.has(key) && entry.numbered);
      if (removed.length > 0) {
        if (changesAllowed) {
          const removedDir = join(folderDir, "removed");
          for (const [, entry] of removed) move(join(folderDir, entry.name), join(removedDir, entry.name));
        }
        const message = `${changesAllowed ? "Moved" : "Would move"} ${removed.length} song(s) no longer in "${collection.name}" to ${join(folderDir, "removed")}.`;
        warnings.push(message);
        if (!options.json) log(message);
      }
    }

    if (renames.length > 0 && changesAllowed) {
      // Renumber in two passes so shifting every song down by one never
      // collides with the next song's current name.
      const staged = renames.map(({ song, wanted }, index) => {
        const temporary = `${song.file}.lyt-sync-${index}`;
        move(song.file, temporary);
        return { song, wanted, temporary };
      });
      for (const { song, wanted, temporary } of staged) {
        const destination = existsSync(wanted) ? song.file : wanted;
        move(temporary, destination);
        song.file = destination;
      }
      if (!options.json) log(`Renumbered ${renames.length} song(s) to match the current order.`);
    }

    collections.push({ name: collection.name, type: collection.type, folder: folderDir, targets });

    if (!options.json) {
      const have = targets.length - fresh;
      log(
        `Spotify ${collection.type} "${collection.name}": ${targets.length} song(s)` +
          (have > 0 ? `, ${have} already downloaded` : "") +
          ` → searching YouTube for ${fresh}.`,
      );
    }
  }

  return { items, skipped, collections, warnings };
}

// Writes "<folder>/<name>.m3u8" listing the collection's songs in Spotify
// order, so music players open the playlist as Spotify shows it. `fileFor`
// maps a target to its saved file (downloaded now or found on disk).
export function writePlaylistFile(collection, fileFor, { write = writeFileSync } = {}) {
  if (collection.type === "track") return null;

  const lines = ["#EXTM3U"];
  for (const target of collection.targets) {
    const file = fileFor(target);
    if (!file) continue;
    const seconds = target.source.durationSeconds ?? -1;
    lines.push(`#EXTINF:${seconds},${target.label}`);
    lines.push(relative(collection.folder, file).split("\\").join("/"));
  }

  if (lines.length === 1) return null;
  const path = join(collection.folder, `${safeName(collection.name)}.m3u8`);
  write(path, `${lines.join("\n")}\n`, "utf8");
  return path;
}

// Strip characters Windows/macOS/Linux reject in path segments.
export function safeName(value) {
  const cleaned = String(value)
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 150);
  return cleaned || "Untitled";
}

// Spotify credentials from the environment or config (client credentials
// flow; no user login). Returns null when not configured.
export function spotifyCredentials(config = {}, env = process.env) {
  const clientId = env.LYT_SPOTIFY_CLIENT_ID || config["spotify-client-id"];
  const clientSecret = env.LYT_SPOTIFY_CLIENT_SECRET || config["spotify-client-secret"];
  return clientId && clientSecret ? { clientId: String(clientId), clientSecret: String(clientSecret) } : null;
}

async function fetchFromApi(parsed, { clientId, clientSecret }, fetchImpl) {
  const tokenResponse = await fetchImpl("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: timeoutSignal(),
  });
  if (!tokenResponse.ok) throw new Error(`token request failed with HTTP ${tokenResponse.status}`);
  const token = (await tokenResponse.json())?.access_token;
  if (!token) throw new Error("token response had no access token");

  const get = async (apiUrl) => {
    const response = await fetchImpl(apiUrl, {
      headers: { authorization: `Bearer ${token}` },
      signal: timeoutSignal(),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const base = "https://api.spotify.com/v1";

  if (parsed.type === "track") {
    const track = await get(`${base}/tracks/${parsed.id}`);
    return {
      name: track.name,
      type: "track",
      tracks: [apiTrack(track)],
      coverUrl: largestImage(track.album?.images),
      truncated: false,
    };
  }

  if (parsed.type === "album") {
    const album = await get(`${base}/albums/${parsed.id}`);
    const items = await collectPages(get, album.tracks);
    return {
      name: album.name,
      type: "album",
      tracks: items.map((track) => apiTrack(track, album)),
      coverUrl: largestImage(album.images),
      truncated: false,
    };
  }

  const playlist = await get(`${base}/playlists/${parsed.id}?fields=name,images,tracks.next,tracks.items(track(id,name,type,duration_ms,track_number,artists(name),album(name,images)))`);
  const items = await collectPages(get, playlist.tracks);
  return {
    name: playlist.name,
    type: "playlist",
    tracks: items
      .map((item) => item?.track)
      .filter((track) => track && (track.type ?? "track") === "track" && track.name)
      .map((track) => apiTrack(track)),
    coverUrl: largestImage(playlist.images),
    truncated: false,
  };
}

async function collectPages(get, page) {
  const items = [...(page?.items ?? [])];
  let next = page?.next;
  let pages = 1;

  while (next && pages < API_MAX_PAGES) {
    const response = await get(next.includes("limit=") ? next : `${next}&limit=${API_PAGE_LIMIT}`);
    items.push(...(response.items ?? []));
    next = response.next;
    pages += 1;
  }

  return items;
}

function apiTrack(track, album = track.album) {
  return {
    title: String(track.name).trim(),
    artist: (track.artists ?? []).map((artist) => artist?.name).filter(Boolean).join(", "),
    durationMs: Number.isFinite(track.duration_ms) ? track.duration_ms : null,
    id: track.id ?? null,
    album: album?.name ?? null,
    trackNumber: Number.isInteger(track.track_number) ? track.track_number : null,
    coverUrl: largestImage(album?.images),
  };
}

// Maps "artist - title" (lowercased, without "NN - " and extension) to the
// file already on disk for it.
function indexExistingSongs(names, extensions, numbered) {
  const index = new Map();
  const pattern = new RegExp(`^(.*)\\.(${extensions.join("|")})$`, "i");

  for (const name of names) {
    const match = pattern.exec(name);
    if (!match) continue;
    const hasNumber = /^\d+ - /.test(match[1]);
    if (numbered !== hasNumber) continue;
    const key = labelKey(match[1]);
    if (!index.has(key)) index.set(key, { name, ext: match[2].toLowerCase(), numbered: hasNumber });
  }

  return index;
}

function labelKey(name) {
  return String(name).replace(/^\d+ - /, "").trim().toLowerCase();
}

function listDirectory(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function moveFile(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
}

function embedEntity(html) {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  return match ? safeJson(match[1])?.props?.pageProps?.state?.data?.entity ?? null : null;
}

function largestImage(images) {
  if (!Array.isArray(images)) return null;
  const sorted = images
    .filter((image) => typeof image?.url === "string")
    .sort((a, b) => (b.maxWidth ?? b.width ?? 0) - (a.maxWidth ?? a.width ?? 0));
  return sorted[0]?.url ?? null;
}

function trackIdFromUri(uri) {
  return /^spotify:track:([A-Za-z0-9]{22})$/.exec(String(uri ?? ""))?.[1] ?? null;
}

function artistNames(artists) {
  return Array.isArray(artists) ? artists.map((artist) => artist?.name).filter(Boolean).join(", ") : "";
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function timeoutSignal() {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}
