import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { labelHeight } from "./quality.js";

// Prompts for a download job and returns a `{ urls, options }` shape that
// matches `parseArgs`, so the answers flow through the same normalize +
// validation path as command-line flags. Streams (and the optional format
// lookup) are injectable for testing.
export async function promptForJob({
  input = stdin,
  output = stdout,
  defaults = {},
  fetchFormats = null,
} = {}) {
  const rl = createInterface({ input, output });

  try {
    const urlLine = await rl.question("YouTube URL(s) (space-separated): ");
    const urls = urlLine.trim().split(/\s+/).filter(Boolean);

    if (urls.length === 0) {
      return null;
    }

    const kind = await ask(rl, "Type [audio/video]", defaults.video ? "video" : "audio");
    const video = kind.toLowerCase().startsWith("v");

    const options = { video };

    if (video) {
      const quality = await pickVideoQuality(rl, output, urls[0], fetchFormats);

      if (quality && !/^best$/i.test(quality)) {
        options.maxHeight = quality;
      }
    } else {
      const format = await ask(rl, "Format [native/mp3]", "native");
      options.mp3 = format.toLowerCase().startsWith("m");

      if (options.mp3) {
        options.quality = await ask(rl, "MP3 quality (128K/192K/320K/0)", "192K");
      }
    }

    options.outputDir = await ask(rl, "Output directory", "downloads");

    if (urls.length > 1) {
      options.jobs = await ask(rl, "Parallel jobs", "1");
    }

    return { urls, options };
  } finally {
    rl.close();
  }
}

// Offers to list the real qualities available for the URL and pick one;
// otherwise (or on any failure) falls back to a free-form preset prompt.
async function pickVideoQuality(rl, output, url, fetchFormats) {
  if (fetchFormats) {
    const wantList = await ask(rl, "List available qualities? [Y/n]", "Y");

    if (/^y/i.test(wantList)) {
      try {
        const { heights } = await fetchFormats(url);

        if (heights.length > 0) {
          output.write("Available video qualities:\n");
          heights.forEach((height, index) => {
            output.write(`  ${index + 1}) ${labelHeight(height)}\n`);
          });

          const choice = await ask(rl, `Pick 1-${heights.length} or 'best'`, "best");

          if (/^\d+$/.test(choice)) {
            const height = heights[Number(choice) - 1];
            return height ? String(height) : "best";
          }

          return choice;
        }
      } catch {
        // Fall through to the manual prompt below.
      }
    }
  }

  return ask(rl, "Quality (8k/4k/1080p/720p/best)", "best");
}

async function ask(rl, label, fallback) {
  const answer = (await rl.question(`${label} [${fallback}]: `)).trim();
  return answer || fallback;
}
