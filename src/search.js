import { runJsonTool } from "./jsonProcess.js";
import { ytDlpJsRuntimeArgs } from "./jsRuntime.js";
import { taggedError } from "./failures.js";

export function parseSearch(payload, limit = 5) {
  if (!payload || !Array.isArray(payload.entries)) {
    throw taggedError("Search output did not contain a results list.", "tool_output_invalid");
  }
  const seen = new Set();
  const results = [];
  for (const entry of payload.entries) {
    if (!entry || typeof entry.id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(entry.id)) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const thumbnails = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
    const thumbnail = entry.thumbnail ?? thumbnails.at(-1)?.url;
    results.push({
      index: results.length + 1,
      id: entry.id,
      extractor: "Youtube",
      title: typeof entry.title === "string" ? entry.title : "",
      uploader: typeof (entry.channel ?? entry.uploader) === "string" ? entry.channel ?? entry.uploader : null,
      durationSeconds: Number.isFinite(entry.duration) && entry.duration >= 0 ? entry.duration : null,
      url: `https://www.youtube.com/watch?v=${entry.id}`,
      thumbnail: typeof thumbnail === "string" && /^https?:\/\//i.test(thumbnail) ? thumbnail : null,
      liveStatus: typeof entry.live_status === "string" ? entry.live_status : null,
      isLive: entry.is_live === true || entry.live_status === "is_live",
      isUpcoming: entry.live_status === "is_upcoming",
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function searchMedia(query, {
  limit = 5, command = "yt-dlp", runtimeArgs = ytDlpJsRuntimeArgs(), ...toolOptions
} = {}) {
  const payload = await runJsonTool(command, [
    "--ignore-config", "--flat-playlist", "--dump-single-json", "--skip-download",
    "--no-warnings", "--no-mark-watched", "--socket-timeout", "15",
    "--retries", "1", "--extractor-retries", "1", ...runtimeArgs,
    "--", `ytsearch${limit}:${query}`,
  ], toolOptions);
  return parseSearch(payload, limit);
}
