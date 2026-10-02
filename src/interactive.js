import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { labelHeight } from "./quality.js";
import { accent, muted } from "./ui.js";

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
    if (output.isTTY) {
      output.write(`${accent("lyt", output)}  ${muted("paste a media link (YouTube, Spotify, SoundCloud, ...), or press Enter to cancel", output)}\n\n`);
    }

    const urlLine = await rl.question("Media URL(s) (space-separated): ");
    const urls = urlLine.trim().split(/\s+/).filter(Boolean);

    if (urls.length === 0) {
      return null;
    }

    const kind = await ask(rl, "Type [audio/video]", defaults.video ? "video" : "audio", output);
    const video = kind.toLowerCase().startsWith("v");

    const options = { video };

    if (video) {
      const quality = await pickVideoQuality(rl, output, urls[0], fetchFormats);

      if (quality && !/^best$/i.test(quality)) {
        options.maxHeight = quality;
      }
    } else {
      const format = await ask(rl, "Format [native/mp3]", "native", output);
      options.mp3 = format.toLowerCase().startsWith("m");

      if (options.mp3) {
        options.quality = await ask(rl, "MP3 quality (128K/192K/320K/0)", "192K", output);
      }
    }

    options.outputDir = await ask(rl, "Output directory", "downloads", output);

    if (urls.length > 1) {
      options.jobs = await ask(rl, "Parallel jobs", "1", output);
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
    const wantList = await ask(rl, "List available qualities? [Y/n]", "Y", output);

    if (/^y/i.test(wantList)) {
      try {
        const { heights } = await fetchFormats(url);

        if (heights.length > 0) {
          output.write(`${muted("Available video qualities:", output)}\n`);
          heights.forEach((height, index) => {
            output.write(`  ${index + 1}) ${labelHeight(height)}\n`);
          });

          const choice = await ask(rl, `Pick 1-${heights.length} or 'best'`, "best", output);

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

  return ask(rl, "Quality (8k/4k/1080p/720p/best)", "best", output);
}

async function ask(rl, label, fallback, output = stdout) {
  const hint = muted(`[${fallback}]`, output);
  const answer = (await rl.question(`${label} ${hint}: `)).trim();
  return answer || fallback;
}
