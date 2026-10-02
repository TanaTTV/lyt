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
export const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
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

/** Compare complete SemVer versions, including prerelease precedence. */
export function compareSemver(left, right) {
  const a = semverParts(left);
  const b = semverParts(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index++) {
    if (a.core[index] !== b.core[index]) return a.core[index] > b.core[index] ? 1 : -1;
  }
  if (!a.pre.length || !b.pre.length) {
    return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
  }
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index++) {
    const x = a.pre[index];
    const y = b.pre[index];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const xNumeric = /^\d+$/.test(x);
    const yNumeric = /^\d+$/.test(y);
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    if (xNumeric) {
      // Compare arbitrarily long numeric identifiers without losing precision.
      if (x.length !== y.length) return x.length > y.length ? 1 : -1;
    }
    return x > y ? 1 : -1;
  }
  return 0;
}

export function parseSemver(value) {
  return semverParts(value)?.core ?? null;
}

function semverParts(value) {
  if (typeof value !== "string") return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
  if (!match) return null;
  const core = match.slice(1, 4).map(Number);
  const pre = match[4]?.split(".") ?? [];
  if (core.some((n) => !Number.isSafeInteger(n)) || pre.some((id) => /^0\d+$/.test(id))) return null;
  return { core, pre };
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
  failureBackoffMs = DEFAULT_FAILURE_BACKOFF_MS,
  cacheFile = updateCheckPath(),
  fetchLatest = fetchLatestVersion,
  loadCache = loadUpdateCache,
  saveCache = saveUpdateCache,
} = {}) {
  // Cache failures are optional and must never prevent the actual operation.
  let cached;
  try { cached = loadCache(cacheFile); } catch { cached = null; }
  const validLatest = parseSemver(cached?.latest) ? cached.latest : null;
  const age = (timestamp) => timestamp ? now - Date.parse(timestamp) : Infinity;
  const fresh = (timestamp, ttl) => Number.isFinite(age(timestamp)) && age(timestamp) >= 0 && age(timestamp) < ttl;
  const fromCache = (source) => validLatest ? buildUpdateResult(currentVersion, validLatest, {
    source, checkedAt: cached.checkedAt ?? null,
  }) : null;
  const save = (value) => { try { saveCache(value, cacheFile); } catch { /* Best effort. */ } };

  if (!force && cached?.failedVersion === currentVersion && fresh(cached.failedAt, failureBackoffMs)) {
    return fromCache("stale-cache");
  }
  if (!force && cached?.current === currentVersion && validLatest && fresh(cached.checkedAt, cacheTtlMs)) {
    return fromCache("cache");
  }

  try {
    const latest = await fetchLatest();
    if (!parseSemver(latest)) throw new Error("Registry returned an invalid version.");
    const checkedAt = new Date(now).toISOString();
    const result = buildUpdateResult(currentVersion, latest, { source: "registry", checkedAt });
    save({ checkedAt, current: currentVersion, latest, updateAvailable: result.updateAvailable });
    return result;
  } catch {
    // Avoid paying the network timeout on every invocation while offline.
    save({ ...cached, failedAt: new Date(now).toISOString(), failedVersion: currentVersion });
    return fromCache("stale-cache");
  }
}

export function buildUpdateResult(currentVersion, latestVersion, { source, checkedAt = null } = {}) {
  const updateAvailable = compareSemver(latestVersion, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    source,
    checkedAt,
    installCommand: `npm install --global ${PACKAGE_NAME}@latest`,
  };
}

export function formatUpdateNotice(update) {
  if (!update?.updateAvailable) return null;
  return [
    `Update available: lyt ${update.latestVersion} (you have ${update.currentVersion})${update.source === "stale-cache" ? " — cached; latest check unavailable" : ""}`,
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
