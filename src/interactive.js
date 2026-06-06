import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Prompts for a download job and returns a `{ urls, options }` shape that
// matches `parseArgs`, so the answers flow through the same normalize +
// validation path as command-line flags. Streams are injectable for testing.
export async function promptForJob({ input = stdin, output = stdout, defaults = {} } = {}) {
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
      const height = await ask(rl, "Max height (e.g. 1080, blank=best)", "");

      if (height) {
        options.maxHeight = height;
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

async function ask(rl, label, fallback) {
  const answer = (await rl.question(`${label} [${fallback}]: `)).trim();
  return answer || fallback;
}
