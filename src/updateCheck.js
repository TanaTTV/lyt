// Lightweight lyt self-update notice.
//
// Checks the public npm registry for the latest @tanattv/lyt version, caches
// the result under the user data directory, and prints a stderr hint when a
// newer release exists. Never blocks downloads for long and never fails a job.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { dataDir } from "./paths.js";
import { VERSION } from "./version.js";

export const PACKAGE_NAME = "@tanattv/lyt";
export const DEFAULT_REGISTRY_URL =
  "https://registry.npmjs.org/@tanattv%2flyt/latest";
export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_FETCH_TIMEOUT_MS = 1500;

export function updateCheckPath(dir = dataDir()) {
  return join(dir, "update-check.json");
}

export function isUpdateCheckEnabled(
  config = {},
  env = process.env,
) {
  if (env.LYT_NO_UPDATE_CHECK === "1") return false;
  if (env.LYT_UPDATE_CHECK === "0") return false;

  const raw = config["update-check"];
  if (raw === undefined || raw === null || raw === "") return true;
  if (typeof raw === "boolean") return raw;

  const text = String(raw).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return true;
}

/** Compare dotted semver cores (pre-release suffixes ignored). Returns -1/0/1. */
export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return 0;

  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }

  return 0;
}

export function parseSemver(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function loadUpdateCache(file = updateCheckPath()) {
  if (!existsSync(file)) return null;

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUpdateCache(cache, file = updateCheckPath()) {
  const directory = dirname(file);
  mkdirSync(directory, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  try {
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export async function fetchLatestVersion({
  registryUrl = DEFAULT_REGISTRY_URL,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(registryUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": `lyt/${VERSION} (+https://github.com/TanaTTV/lyt)`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`registry responded with HTTP ${response.status}`);
    }

    const body = await response.json();
    const version = body?.version;
    if (typeof version !== "string" || !parseSemver(version)) {
      throw new Error("registry response did not include a valid version");
    }

    return version;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve whether an update is available.
 * Returns null when checks are disabled, offline, or the registry is unclear.
 */
export async function checkForUpdate({
  currentVersion = VERSION,
  force = false,
  now = Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  cacheFile = updateCheckPath(),
  fetchLatest = fetchLatestVersion,
  loadCache = loadUpdateCache,
  saveCache = saveUpdateCache,
} = {}) {
  const cached = loadCache(cacheFile);
  const cacheAge = cached?.checkedAt ? now - Date.parse(cached.checkedAt) : Number.POSITIVE_INFINITY;
  const cacheFresh = Number.isFinite(cacheAge) && cacheAge >= 0 && cacheAge < cacheTtlMs;

  if (!force && cacheFresh && typeof cached?.latest === "string") {
    return buildUpdateResult(currentVersion, cached.latest, { source: "cache" });
  }

  try {
    const latest = await fetchLatest();
    const result = buildUpdateResult(currentVersion, latest, { source: "registry" });
    try {
      saveCache({
        checkedAt: new Date(now).toISOString(),
        current: currentVersion,
        latest,
        updateAvailable: result.updateAvailable,
      }, cacheFile);
    } catch {
      // Cache writes are best-effort; still report the live result.
    }
    return result;
  } catch {
    if (typeof cached?.latest === "string") {
      return buildUpdateResult(currentVersion, cached.latest, { source: "stale-cache" });
    }
    return null;
  }
}

export function buildUpdateResult(currentVersion, latestVersion, { source } = {}) {
  const updateAvailable = compareSemver(latestVersion, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    source,
    installCommand: `npm install --global ${PACKAGE_NAME}@latest`,
  };
}

export function formatUpdateNotice(update) {
  if (!update?.updateAvailable) return null;
  return [
    `Update available: lyt ${update.latestVersion} (you have ${update.currentVersion})`,
    `  ${update.installCommand}`,
  ].join("\n");
}

/** Print an update notice to stderr when appropriate. Never throws. */
export async function maybeNotifyUpdate({
  enabled = true,
  force = false,
  log = console.error,
  check = checkForUpdate,
} = {}) {
  if (!enabled) return null;

  try {
    const update = await check({ force });
    const notice = formatUpdateNotice(update);
    if (notice) log(notice);
    return update;
  } catch {
    return null;
  }
}
