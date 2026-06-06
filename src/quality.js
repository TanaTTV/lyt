// Friendly video-quality tokens. Lets users say "1080p", "4k", or "best"
// instead of remembering "--max-height 2160".

const PRESETS = new Map([
  ["8k", 4320],
  ["4320p", 4320],
  ["4k", 2160],
  ["uhd", 2160],
  ["2160p", 2160],
  ["2k", 1440],
  ["qhd", 1440],
  ["1440p", 1440],
  ["fhd", 1080],
  ["1080p", 1080],
  ["hd", 720],
  ["720p", 720],
  ["480p", 480],
  ["360p", 360],
  ["240p", 240],
  ["144p", 144],
]);

const LABELS = new Map([
  [4320, "4320p (8K)"],
  [2160, "2160p (4K)"],
  [1440, "1440p (2K)"],
  [1080, "1080p (Full HD)"],
  [720, "720p (HD)"],
  [480, "480p"],
  [360, "360p"],
  [240, "240p"],
  [144, "144p"],
]);

// Returns a max-height number, or null for "best"/no cap. Throws on garbage.
export function resolveHeight(token) {
  const value = String(token).trim().toLowerCase();

  if (value === "" || value === "best" || value === "max") {
    return null;
  }

  if (PRESETS.has(value)) {
    return PRESETS.get(value);
  }

  // Bare numbers, with or without a trailing "p": "1080", "1080p".
  const match = /^(\d+)p?$/.exec(value);

  if (match) {
    const height = Number(match[1]);

    if (Number.isInteger(height) && height > 0) {
      return height;
    }
  }

  const error = new Error(
    "quality must look like 1080p, 720p, 4k, 8k, or best.",
  );
  error.exitCode = 2;
  throw error;
}

// Human-readable label for a resolution height (e.g. 2160 -> "2160p (4K)").
export function labelHeight(height) {
  return LABELS.get(height) ?? `${height}p`;
}
