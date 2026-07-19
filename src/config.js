// Smart profiles and persistent user defaults.
//
// Profiles are curated option bundles: `--profile music` beats remembering
// four flags. The config file (JSON, in the user data dir) stores defaults
// applied to every run; explicit flags always win.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import process from "node:process";
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

// A malformed config is moved aside and defaults are used. The warning keeps a
// bad file from silently changing output locations or quality settings.
export function loadConfig(file = configPath(), { warn = console.error } = {}) {
  if (!existsSync(file)) return {};

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("config root must be a JSON object");
    }
    return parsed;
  } catch (error) {
    const backup = `${file}.corrupt-${Date.now()}`;
    try {
      renameSync(file, backup);
      warn(`lyt ignored a corrupt config and moved it to ${backup}: ${error.message}`);
    } catch {
      warn(`lyt ignored a corrupt config at ${file}: ${error.message}`);
    }
    return {};
  }
}

export function saveConfig(config, file = configPath()) {
  if (!isAbsolute(file)) {
    throw new Error(`Config path must be absolute: ${file}`);
  }

  const directory = dirname(file);
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;

  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32" && directory === dataDir()) {
      chmodSync(directory, 0o700);
    }
    writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });

    try {
      renameSync(temporary, file);
    } catch (error) {
      // Windows can reject replacing an existing destination. Remove only after
      // the complete temporary file is safely written.
      if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
      rmSync(file, { force: true });
      renameSync(temporary, file);
    }
    if (process.platform !== "win32") chmodSync(file, 0o600);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw new Error(`Could not save config at ${file}: ${error.message}`, {
      cause: error,
    });
  }
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

export function configToOptions(config) {
  const options = {};

  for (const [key, value] of Object.entries(config)) {
    const spec = CONFIG_KEYS.get(key);
    if (!spec || spec.option === "profile") continue;
    options[spec.option] = spec.parse ? spec.parse(value) : value;
  }

  return options;
}
