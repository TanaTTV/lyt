import test from "node:test";
import assert from "node:assert/strict";
import { labelHeight, resolveHeight } from "../src/quality.js";

test("resolves named presets to heights", () => {
  assert.equal(resolveHeight("8k"), 4320);
  assert.equal(resolveHeight("4K"), 2160);
  assert.equal(resolveHeight("2k"), 1440);
  assert.equal(resolveHeight("1080p"), 1080);
  assert.equal(resolveHeight("hd"), 720);
});

test("resolves bare numbers with or without trailing p", () => {
  assert.equal(resolveHeight("1080"), 1080);
  assert.equal(resolveHeight("720p"), 720);
  assert.equal(resolveHeight(2160), 2160);
});

test("best/max/blank mean no cap", () => {
  assert.equal(resolveHeight("best"), null);
  assert.equal(resolveHeight("max"), null);
  assert.equal(resolveHeight(""), null);
});

test("rejects nonsense quality tokens", () => {
  for (const bad of ["ultra", "1080i", "abc", "-720", "0"]) {
    assert.throws(() => resolveHeight(bad), /quality must/);
  }
});

test("labels known resolutions and falls back for others", () => {
  assert.equal(labelHeight(2160), "2160p (4K)");
  assert.equal(labelHeight(1080), "1080p (Full HD)");
  assert.equal(labelHeight(999), "999p");
});
