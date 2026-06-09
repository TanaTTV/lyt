import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertConfigKey,
  configToOptions,
  loadConfig,
  profileNames,
  resolveProfile,
  saveConfig,
} from "../src/config.js";
import { normalizeOptions } from "../src/ytDlp.js";

function tempConfigFile() {
  const dir = mkdtempSync(join(tmpdir(), "lyt-config-"));
  return { file: join(dir, "config.json"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("profiles exist and resolve to sensible option bundles", () => {
  assert.deepEqual(profileNames(), ["music", "podcast", "voice"]);

  const music = resolveProfile("music");
  assert.equal(music.mp3, true);
  assert.equal(music.embedThumbnail, true);

  const podcast = resolveProfile("PODCAST"); // case-insensitive
  assert.equal(podcast.normalize, true);
  assert.equal(podcast.quality, "96K");

  const voice = resolveProfile("voice");
  assert.equal(voice.quality, "64K");
});

test("unknown profile throws with exit code 2", () => {
  try {
    resolveProfile("metal");
    assert.fail("expected throw");
  } catch (error) {
    assert.match(error.message, /Unknown profile/);
    assert.equal(error.exitCode, 2);
  }
});

test("profile options normalize cleanly (podcast implies mp3 + normalize)", () => {
  const options = normalizeOptions(resolveProfile("podcast"));

  assert.equal(options.mp3, true);
  assert.equal(options.normalize, true);
  assert.equal(options.quality, "96K");
});

test("config round-trips through save and load", () => {
  const { file, cleanup } = tempConfigFile();

  try {
    saveConfig({ quality: "320K", "embed-metadata": "true" }, file);

    const config = loadConfig(file);

    assert.equal(config.quality, "320K");
    assert.equal(config["embed-metadata"], "true");
  } finally {
    cleanup();
  }
});

test("loadConfig tolerates a missing or corrupt file", () => {
  assert.deepEqual(loadConfig(join(tmpdir(), "lyt-no-such-config.json")), {});

  const { file, cleanup } = tempConfigFile();

  try {
    writeFileSync(file, "{ not json");
    assert.deepEqual(loadConfig(file), {});
  } finally {
    cleanup();
  }
});

test("configToOptions maps kebab keys to option names and parses booleans", () => {
  const options = configToOptions({
    "output-dir": "D:/music",
    quality: "320K",
    "embed-thumbnail": "true",
    normalize: "false",
    profile: "music", // excluded: resolved separately so flags can win
    bogus: "ignored",
  });

  assert.deepEqual(options, {
    outputDir: "D:/music",
    quality: "320K",
    embedThumbnail: true,
    normalize: false,
  });
});

test("boolean config values reject garbage", () => {
  assert.throws(() => configToOptions({ mp3: "maybe" }), /Expected true or false/);
});

test("assertConfigKey accepts known keys and rejects unknown ones", () => {
  assertConfigKey("quality");
  assertConfigKey("output-dir");

  try {
    assertConfigKey("speed");
    assert.fail("expected throw");
  } catch (error) {
    assert.match(error.message, /Unknown config key/);
    assert.equal(error.exitCode, 2);
  }
});
