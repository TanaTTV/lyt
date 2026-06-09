// YouTube URL recognition and video-ID extraction. Shared by clipboard
// paste, watch mode, and download-history dedupe. Pure functions, no I/O.

const URL_PATTERN =
  /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s<>"'`]+|shorts\/[\w-]+[^\s<>"'`]*|live\/[\w-]+[^\s<>"'`]*|playlist\?[^\s<>"'`]+)|youtu\.be\/[\w-]+[^\s<>"'`]*)/g;

// Pulls every YouTube URL out of arbitrary text (clipboard content, notes,
// chat messages). Deduped by video ID when one is present, otherwise by the
// exact URL, preserving first-seen order.
export function extractYouTubeUrls(text) {
  const matches = String(text ?? "").match(URL_PATTERN) ?? [];
  const seen = new Set();
  const urls = [];

  for (const raw of matches) {
    // Strip punctuation that commonly trails a pasted link.
    const url = raw.replace(/[)\]}>,.;!?'"`]+$/, "");
    const key = extractVideoId(url) ?? url;

    if (!seen.has(key)) {
      seen.add(key);
      urls.push(url);
    }
  }

  return urls;
}

// Returns the 11-character video ID, or null for URLs without one
// (e.g. pure playlist links).
export function extractVideoId(url) {
  const text = String(url ?? "");

  return (
    /[?&]v=([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    /youtu\.be\/([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    /\/shorts\/([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    /\/live\/([\w-]{11})(?![\w-])/.exec(text)?.[1] ??
    null
  );
}
