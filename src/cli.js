// Download coordinator. Subcommands are routed in entry.js; this module only
// runs parse → config → clipboard → interactive / list / dry-run / download.

import process from "node:process";
import { resolve } from "node:path";
import {
  formatCommand,
  normalizeOptions,
  parseArgs,
  usage,
} from "./ytDlp.js";
import { promptForJob } from "./interactive.js";
import { listFormats, printFormats } from "./formats.js";
import { ensureYtDlp } from "./bootstrap.js";
import {
  mergeClipboardUrls,
  readClipboard,
  shouldReadClipboardForUrls,
} from "./clipboard.js";
import { configToOptions, loadConfig, resolveProfile } from "./config.js";
import {
  buildTasks,
  downloadUrls,
  prepareTools,
  runWatchMode,
} from "./download.js";
import { handleCliError, usageError } from "./errors.js";
import { errorDetails, resultEnvelope } from "./result.js";
import { VERSION } from "./version.js";
import {
  isUpdateCheckEnabled,
  maybeNotifyUpdate,
} from "./updateCheck.js";

// Re-export helpers tests and external callers may import from cli.js.
export {
  mergeClipboardUrls,
  shouldReadClipboardForUrls,
} from "./clipboard.js";
export { runCommand } from "./process.js";

export function run(argv, defaults = {}) {
  return main(argv, defaults).catch((error) => {
    handleCliError(error, { json: argv.includes("--json") });
  });
}

export async function main(argv, defaults = {}) {
  const parsed = parseArgs(argv);

  // Option precedence (lowest to highest): entry-point defaults (yt4 ->
  // video), persistent config file, --profile bundle, explicit flags.
  const userConfig = loadConfig();
  const updateCheckEnabled = isUpdateCheckEnabled(userConfig);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  if (parsed.version) {
    console.log(`lyt ${VERSION}`);
    if (updateCheckEnabled) {
      await maybeNotifyUpdate({ enabled: true, force: false });
    }
    return;
  }

  const profileName = parsed.options.profile ?? userConfig.profile ?? null;
  const profileOptions = profileName ? resolveProfile(profileName) : {};
  parsed.options = {
    ...defaults,
    ...configToOptions(userConfig),
    ...profileOptions,
    ...parsed.options,
  };

  // Explicit --paste always reads the clipboard. With no URL on an interactive
  // TTY, also auto-read so "copy link → lyt" works without flags. Scripts,
  // --json, and non-TTY runs stay explicit (no silent clipboard access).
  if (
    shouldReadClipboardForUrls({
      urls: parsed.urls,
      paste: parsed.options.paste,
      watch: parsed.options.watch,
      json: parsed.options.json,
      isTTY: Boolean(process.stdin.isTTY),
    })
  ) {
    const { urls, fromClipboard } = mergeClipboardUrls({
      urls: parsed.urls,
      clipboardText: readClipboard(),
      paste: parsed.options.paste,
      watch: parsed.options.watch,
    });
    parsed.urls = urls;

    if (fromClipboard.length > 0) {
      console.error(`Picked up ${fromClipboard.length} URL(s) from the clipboard.`);
    }
  }

  const wantsInteractive =
    parsed.options.interactive ||
    (parsed.urls.length === 0 &&
      !parsed.options.watch &&
      process.stdin.isTTY &&
      !parsed.options.dryRun &&
      !parsed.options.printCommand &&
      !parsed.options.json);

  const noDownload =
    parsed.options.noDownload ?? process.env.LYT_NO_DOWNLOAD === "1";

  if (wantsInteractive) {
    const fetchFormats = async (url) =>
      listFormats(url, {
        command: await ensureYtDlp({ noDownload }),
      });

    const job = await promptForJob({ defaults: parsed.options, fetchFormats });

    if (!job) {
      return;
    }

    parsed.urls = job.urls;
    parsed.options = { ...parsed.options, ...job.options };
  }

  const options = normalizeOptions(parsed.options);
  const urls = parsed.urls;

  if (urls.length === 0 && !options.watch) {
    const error = new Error(`${usage()}\n\nMissing URL.`);
    error.exitCode = 2;
    throw error;
  }

  if (options.listFormats) {
    const command = await ensureYtDlp({ noDownload });
    const results = [];

    for (const url of urls) {
      try {
        const formats = await listFormats(url, { command });
        results.push({ url, status: "available", ...formats });
        if (!options.json) printFormats(url, formats);
      } catch (error) {
        results.push({ url, status: "failed", error: errorDetails(error) });
        if (!options.json) console.error(`- ${url}: ${error.message}`);
      }
    }

    if (options.json) {
      console.log(JSON.stringify(resultEnvelope({
        command: "formats",
        ok: results.every((result) => result.status !== "failed"),
        results,
        version: VERSION,
      })));
    }

    if (results.some((result) => result.status === "failed")) {
      process.exitCode = 1;
    }

    return;
  }

  if (options.dryRun) {
    const tools = { ytDlpCommand: "yt-dlp", ffmpegPath: null };
    const tasks = buildTasks(urls, options, tools, { capturePaths: false });

    if (options.json) {
      console.log(JSON.stringify(resultEnvelope({
        command: "dry-run",
        ok: true,
        results: tasks.map((task) => ({
          url: task.url,
          status: "planned",
          command: formatCommand(tools.ytDlpCommand, task.args),
          executable: tools.ytDlpCommand,
          args: task.args,
          outputDir: resolve(options.outputDir),
        })),
        version: VERSION,
      })));
    } else {
      for (const task of tasks) {
        console.log(formatCommand(tools.ytDlpCommand, task.args));
      }
    }

    return;
  }

  const tools = await prepareTools(options, noDownload);

  if (options.watch) {
    if (options.json) {
      throw usageError("--json cannot be combined with --watch; use bounded URL batches.");
    }
    return runWatchMode(urls, options, tools);
  }

  const { failures, results } = await downloadUrls(urls, options, tools);

  if (options.json) {
    console.log(JSON.stringify(resultEnvelope({
      command: "download",
      ok: failures.length === 0,
      results,
      version: VERSION,
    })));
  }

  if (failures.length > 0) {
    const lines = failures.map(({ url, error }) => `- ${url}: ${error.message}`);
    const error = new Error(`Download failed:\n${lines.join("\n")}`);
    error.exitCode = 1;
    error.jsonPrinted = options.json;
    throw error;
  }

  // Human runs only: quiet npm registry check so people notice new releases.
  if (!options.json && updateCheckEnabled) {
    await maybeNotifyUpdate({ enabled: true });
  }
}
