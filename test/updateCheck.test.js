import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildUpdateResult,
  checkForUpdate,
  compareSemver,
  formatUpdateNotice,
  isUpdateCheckEnabled,
  loadUpdateCache,
  parseSemver,
  saveUpdateCache,
  fetchLatestVersion,
} from "../src/updateCheck.js";

test("compareSemver orders dotted versions", () => {
  assert.equal(compareSemver("0.7.4", "0.7.3"), 1);
  assert.equal(compareSemver("0.7.3", "0.7.4"), -1);
  assert.equal(compareSemver("0.7.3", "0.7.3"), 0);
  assert.equal(compareSemver("v1.2.3", "1.2.3"), 0);
  assert.equal(compareSemver("1.10.0", "1.9.9"), 1);
});

test("parseSemver ignores prerelease suffixes", () => {
  assert.deepEqual(parseSemver("1.2.3-beta.1"), [1, 2, 3]);
  assert.equal(parseSemver("not-a-version"), null);
});

test("isUpdateCheckEnabled respects env and config", () => {
  assert.equal(isUpdateCheckEnabled({}, {}), true);
  assert.equal(isUpdateCheckEnabled({}, { LYT_NO_UPDATE_CHECK: "1" }), false);
  assert.equal(isUpdateCheckEnabled({}, { LYT_UPDATE_CHECK: "0" }), false);
  assert.equal(isUpdateCheckEnabled({ "update-check": false }, {}), false);
  assert.equal(isUpdateCheckEnabled({ "update-check": "false" }, {}), false);
  assert.equal(isUpdateCheckEnabled({ "update-check": true }, {}), true);
});

test("formatUpdateNotice only prints when an update exists", () => {
  assert.equal(formatUpdateNotice(buildUpdateResult("0.7.3", "0.7.3")), null);

  const notice = formatUpdateNotice(buildUpdateResult("0.7.3", "0.7.4"));
  assert.match(notice, /Update available: lyt 0.7.4/);
  assert.match(notice, /npm install --global @tanattv\/lyt@latest/);
});

test("checkForUpdate uses a fresh cache without calling the registry", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lyt-update-"));
  const cacheFile = join(dir, "update-check.json");
  const now = Date.parse("2026-08-12T12:00:00.000Z");

  saveUpdateCache({
    checkedAt: new Date(now - 1000).toISOString(),
    current: "0.7.3",
    latest: "0.7.4",
    updateAvailable: true,
  }, cacheFile);

  let fetches = 0;
  const result = await checkForUpdate({
    currentVersion: "0.7.3",
    now,
    cacheFile,
    fetchLatest: async () => {
      fetches += 1;
      return "9.9.9";
    },
  });

  assert.equal(fetches, 0);
  assert.equal(result.updateAvailable, true);
  assert.equal(result.latestVersion, "0.7.4");
  assert.equal(result.source, "cache");
  rmSync(dir, { recursive: true, force: true });
});

test("checkForUpdate refreshes a stale cache from the registry", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lyt-update-"));
  const cacheFile = join(dir, "update-check.json");
  const now = Date.parse("2026-08-12T12:00:00.000Z");

  writeFileSync(cacheFile, JSON.stringify({
    checkedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
    latest: "0.7.0",
  }), "utf8");

  const result = await checkForUpdate({
    currentVersion: "0.7.3",
    now,
    cacheFile,
    fetchLatest: async () => "0.7.5",
  });

  assert.equal(result.latestVersion, "0.7.5");
  assert.equal(result.updateAvailable, true);
  assert.equal(result.source, "registry");

  const cached = loadUpdateCache(cacheFile);
  assert.equal(cached.latest, "0.7.5");
  assert.equal(cached.updateAvailable, true);
  rmSync(dir, { recursive: true, force: true });
});

test("checkForUpdate falls back to stale cache when registry fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lyt-update-"));
  const cacheFile = join(dir, "update-check.json");

  saveUpdateCache({
    checkedAt: "2020-01-01T00:00:00.000Z",
    latest: "0.8.0",
  }, cacheFile);

  const result = await checkForUpdate({
    currentVersion: "0.7.3",
    cacheFile,
    fetchLatest: async () => {
      throw new Error("offline");
    },
  });

  assert.equal(result.latestVersion, "0.8.0");
  assert.equal(result.updateAvailable, true);
  assert.equal(result.source, "stale-cache");
  rmSync(dir, { recursive: true, force: true });
});

test("checkForUpdate returns null when offline with no cache", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lyt-update-"));
  const cacheFile = join(dir, "missing.json");

  const result = await checkForUpdate({
    currentVersion: "0.7.3",
    cacheFile,
    fetchLatest: async () => {
      throw new Error("offline");
    },
  });

  assert.equal(result, null);
  rmSync(dir, { recursive: true, force: true });
});

test("saveUpdateCache writes readable JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "lyt-update-"));
  const cacheFile = join(dir, "nested", "update-check.json");
  saveUpdateCache({ checkedAt: "2026-08-12T00:00:00.000Z", latest: "0.7.4" }, cacheFile);
  const raw = readFileSync(cacheFile, "utf8");
  assert.match(raw, /0\.7\.4/);
  rmSync(dir, { recursive: true, force: true });
});

test("version parsing rejects partial or malformed versions and orders prereleases", () => {
  for (const version of ["1.2.3garbage", "01.2.3", "1.2", "1.2.3-beta.01", "1.2.3\n"]) {
    assert.equal(parseSemver(version), null, version);
  }
  assert.equal(compareSemver("0.8.1-beta.2", "0.8.1-beta.10"), -1);
  assert.equal(compareSemver("0.8.1-beta.10", "0.8.1"), -1);
  assert.equal(compareSemver("0.8.1+build.1", "0.8.1+build.2"), 0);
});

test("installing a new lyt version invalidates an otherwise fresh cache", async () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  const result = await checkForUpdate({
    currentVersion: "0.8.1", now,
    loadCache: () => ({ current: "0.8.0", latest: "0.8.0", checkedAt: new Date(now - 1000).toISOString() }),
    fetchLatest: async () => "0.8.2", saveCache: () => {},
  });
  assert.equal(result.source, "registry");
  assert.equal(result.latestVersion, "0.8.2");
});

test("offline failures back off, then retry; an explicit refresh bypasses backoff", async () => {
  let cache;
  let fetches = 0;
  const now = Date.parse("2026-10-02T12:00:00Z");
  const options = {
    currentVersion: "0.8.1", now,
    loadCache: () => cache, saveCache: (value) => { cache = value; },
    fetchLatest: async () => { fetches++; throw new Error("offline"); },
  };
  assert.equal(await checkForUpdate(options), null);
  assert.equal(await checkForUpdate({ ...options, now: now + 1000 }), null);
  assert.equal(fetches, 1);
  await checkForUpdate({ ...options, now: now + 1000, force: true });
  assert.equal(fetches, 2);
  await checkForUpdate({ ...options, now: now + 6 * 60 * 1000 });
  assert.equal(fetches, 3);
});

test("cache errors and invalid registry versions never create a false update notice", async () => {
  const result = await checkForUpdate({
    loadCache: () => { throw new Error("unreadable"); },
    fetchLatest: async () => "0.8.2", saveCache: () => { throw new Error("unwritable"); },
  });
  assert.equal(result.latestVersion, "0.8.2");
  assert.equal(await checkForUpdate({
    loadCache: () => ({ latest: "bad" }), fetchLatest: async () => "99.0.0garbage", saveCache: () => {},
  }), null);
  assert.match(formatUpdateNotice(buildUpdateResult("0.8.0", "0.8.1", { source: "stale-cache" })), /cached/);
});

test("registry requests validate responses and abort within their deadline", async () => {
  await assert.rejects(fetchLatestVersion({
    timeoutMs: 10,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  }), /aborted/);
  await assert.rejects(fetchLatestVersion({
    fetchImpl: async () => ({ ok: true, json: async () => ({ version: "1.2.3bad" }) }),
  }), /valid version/);
});
