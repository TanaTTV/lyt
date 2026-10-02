// Media URL recognition, video-ID extraction, and history keys. Shared by
// clipboard paste, watch mode, the playlist guard, and download-history
// dedupe. Pure functions, no I/O.

const URL_TAIL = String.raw`[^\s<>"'\x60]*`;

const URL_PATTERN =
  /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s<>"'`]+|shorts\/[\w-]+[^\s<>"'`]*|live\/[\w-]+[^\s<>"'`]*|embed\/[\w-]+[^\s<>"'`]*|playlist\?[^\s<>"'`]+)|youtu\.be\/[\w-]+[^\s<>"'`]*)/g;

// Links that lyt handles beyond YouTube: Spotify collections (expanded into
// per-song searches) and common music/video hosts that yt-dlp supports.
const OTHER_MEDIA_PATTERNS = [
  new RegExp(String.raw`https?:\/\/open\.spotify\.com\/(?:intl-[\w-]+\/)?(?:embed\/)?(?:playlist|album|track|artist)\/[A-Za-z0-9]{22}${URL_TAIL}`, "g"),
  new RegExp(String.raw`https?:\/\/(?:www\.|m\.)?soundcloud\.com\/[\w-]+${URL_TAIL}`, "g"),
  new RegExp(String.raw`https?:\/\/on\.soundcloud\.com\/[\w-]+${URL_TAIL}`, "g"),
  new RegExp(String.raw`https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?\d+${URL_TAIL}`, "g"),
  new RegExp(String.raw`https?:\/\/[\w-]+\.bandcamp\.com\/(?:track|album)\/[\w-]+${URL_TAIL}`, "g"),
];

// Query parameters that only track sharing and never change the media.
const TRACKING_PARAMS = new Set([
  "si", "feature", "pp", "ref", "ref_src", "in", "fbclid", "gclid", "igshid",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
]);

// Pulls every YouTube URL out of arbitrary text (clipboard content, notes,
// chat messages). Deduped by video ID when one is present, otherwise by the
// exact URL, preserving first-seen order.
export function extractYouTubeUrls(text) {
  return dedupeUrlList((String(text ?? "").match(URL_PATTERN) ?? []).map(trimTrailing));
}

// YouTube links plus Spotify, SoundCloud, Vimeo, and Bandcamp links. Used by
// clipboard paste and watch mode, so copied links from those hosts work too.
export function extractMediaUrls(text) {
  const value = String(text ?? "");
  const found = [];

  for (const pattern of [URL_PATTERN, ...OTHER_MEDIA_PATTERNS]) {
    for (const match of value.matchAll(pattern)) {
      found.push({ index: match.index, url: trimTrailing(match[0]) });
    }
  }

  // Keep the order the links appear in the text.
  found.sort((a, b) => a.index - b.index);
  return dedupeUrlList(found.map((entry) => entry.url));
}

// Kept for callers of the 0.8.2 preview name.
export const extractPasteUrls = extractMediaUrls;

// Returns the 11-character video ID, or null for URLs without one
// (e.g. pure playlist links).
export function extractVideoId(url) {
  const text = String(url ?? "");

  return (
    /[?&]v=([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    /youtu\.be\/([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    /\/shorts\/([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    /\/live\/([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    null
  );
}

// Canonical form for comparing links: lowercase host without www./m., no
// fragment, no tracking parameters, no trailing slash. Non-URL targets such
// as "ytsearch1:..." are returned trimmed.
export function normalizeUrl(url) {
  const text = String(url ?? "").trim();
  let parsed;

  try {
    parsed = new URL(text);
  } catch {
    return text;
  }

  if (!/^https?:$/.test(parsed.protocol)) return text;

  const host = parsed.hostname.toLowerCase().replace(/^(?:www|m)\./, "");
  const params = [...parsed.searchParams]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length > 0 ? `?${new URLSearchParams(params)}` : "";
  const path = parsed.pathname.replace(/\/+$/, "");

  return `https://${host}${path}${query}`;
}

// Identity used for dedupe and history: the YouTube video ID when there is
// one, otherwise the normalized URL (works for every other site).
export function urlKey(url) {
  const id = extractVideoId(url);
  return id ? `youtube:${id}` : normalizeUrl(url);
}

/** Deduplicate a URL list by video ID when present, else normalized URL. */
export function dedupeUrlList(urls) {
  const seen = new Set();
  const unique = [];

  for (const url of urls) {
    const key = urlKey(url);

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(url);
    }
  }

  return unique;
}

const SOUNDCLOUD_RESERVED = new Set([
  "discover", "search", "stream", "you", "upload", "charts", "pages",
  "terms-of-use", "settings", "messages", "notifications", "people", "jobs",
]);
const SOUNDCLOUD_COLLECTIONS = new Set([
  "sets", "likes", "reposts", "tracks", "albums", "popular-tracks", "toptracks",
]);

// Describes links that always expand into many items (playlists, channels,
// sets, profiles), or returns null. yt-dlp's --no-playlist only affects links
// that point at one video inside a playlist, so lyt refuses these itself
// unless --playlist was given.
export function describeCollectionUrl(url) {
  const text = String(url ?? "").trim();

  const search = /^ytsearch(\d+|all):/i.exec(text);
  if (search) {
    return search[1].toLowerCase() === "all" || Number(search[1]) > 1
      ? "a search with several results"
      : null;
  }

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^(?:www|m|music)\./, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  const first = (segments[0] ?? "").toLowerCase();

  if (host === "youtube.com") {
    if (first === "playlist") return "a YouTube playlist";
    if (first.startsWith("@") || ["channel", "c", "user"].includes(first)) {
      return "a YouTube channel";
    }
    return null;
  }

  if (host === "soundcloud.com") {
    if (first === "discover" && segments[1] === "sets") return "a SoundCloud set";
    if (segments.length === 1 && !SOUNDCLOUD_RESERVED.has(first)) return "a SoundCloud profile";
    const second = (segments[1] ?? "").toLowerCase();
    if (second === "sets" || second === "albums") return "a SoundCloud set";
    if (SOUNDCLOUD_COLLECTIONS.has(second) && segments.length === 2) return "a SoundCloud profile";
    return null;
  }

  if (host.endsWith(".bandcamp.com")) {
    if (first === "album") return "a Bandcamp album";
    if (segments.length === 0 || first === "music") return "a Bandcamp profile";
    return null;
  }

  if (host === "vimeo.com") {
    // showcase/<id> and album/<id> are collections unless a video is named;
    // channels/<name>/<video-id> is one video inside a channel.
    if (["showcase", "album"].includes(first)) {
      return segments.includes("video") ? null : "a Vimeo collection";
    }
    if (first === "channels") {
      return segments.length >= 3 && /^\d+$/.test(segments.at(-1)) ? null : "a Vimeo collection";
    }
    return null;
  }

  return null;
}

function trimTrailing(raw) {
  // Strip punctuation that commonly trails a pasted link.
  return raw.replace(/[)\]}>,.;!?'"`]+$/, "");
}
