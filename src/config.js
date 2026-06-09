// Smart profiles and persistent user defaults.
//
// Profiles are curated option bundles: `--profile music` beats remembering
// four flags. The config file (JSON, in the user data dir) stores defaults
// applied to every run; explicit flags always win.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { dataDir } from "./paths.js";

export const PROFILES = {
  // Keep every bit of quality and make the file pretty in players.
  music: { mp3: true, quality: "0", embedMetadata: true, embedThumbnail: true },
  // Spoken word: smaller files, evened-out loudness.
  podcast: { mp3: true, quality: "96K", normalize: true, embedMetadata: true },
  // Smallest useful files for voice notes / lectures.
  voice: { mp3: true, quality: "64K", normalize: true },
};

export function profileNames() {
  return Object.keys(PROFILES);
}

export function resolveProfile(name) {
  const profile = PROFILES[String(name).trim().toLowerCase()];

  if (!profile) {
    const error = new Error(
      `Unknown profile: ${name}. Available: ${profileNames().join(", ")}.`,
    );
    error.exitCode = 2;
    throw error;
  }

  return { ...profile };
}

// Config keys (kebab-case, as typed by the user) -> parsed option fields.
const BOOL = (value) => {
  const text = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;

  const error = new Error(`Expected true or false, got: ${value}`);
  error.exitCode = 2;
  throw error;
};

const CONFIG_KEYS = new Map([
  ["output-dir", { option: "outputDir" }],
  ["quality", { option: "quality" }],
  ["template", { option: "template" }],
  ["fragments", { option: "fragments" }],
  ["jobs", { option: "jobs" }],
  ["profile", { option: "profile" }],
  ["mp3", { option: "mp3", parse: BOOL }],
  ["embed-metadata", { option: "embedMetadata", parse: BOOL }],
  ["embed-thumbnail", { option: "embedThumbnail", parse: BOOL }],
  ["normalize", { option: "normalize", parse: BOOL }],
  ["downloader", { option: "downloader" }],
  ["downloader-args", { option: "downloaderArgs" }],
]);

export function configKeys() {
  return [...CONFIG_KEYS.keys()];
}

export function configPath(dir = dataDir()) {
  return join(dir, "config.json");
}

// Raw config: { "kebab-key": "string value", ... }. Unknown/corrupt content
// degrades to an empty config rather than breaking the CLI.
export function loadConfig(file = configPath()) {
  if (!existsSync(file)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function saveConfig(config, file = configPath()) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

export function assertConfigKey(key) {
  if (!CONFIG_KEYS.has(key)) {
    const error = new Error(
      `Unknown config key: ${key}. Valid keys: ${configKeys().join(", ")}.`,
    );
    error.exitCode = 2;
    throw error;
  }
}

// Converts a raw config object into a parseArgs-style options bag. The
// `profile` key is intentionally excluded — the caller resolves it so a
// `--profile` flag can take precedence over the configured one.
export function configToOptions(config) {
  const options = {};

  for (const [key, value] of Object.entries(config)) {
    const spec = CONFIG_KEYS.get(key);

    if (!spec || spec.option === "profile") {
      continue;
    }

    options[spec.option] = spec.parse ? spec.parse(value) : value;
  }

  return options;
}
