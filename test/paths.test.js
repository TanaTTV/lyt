import test from "node:test";
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { dataDir } from "../src/paths.js";

test("dataDir is always absolute", () => {
  assert.equal(isAbsolute(dataDir()), true);
});

test("dataDir rejects missing Windows home variables", { skip: process.platform !== "win32" }, () => {
  const localAppData = process.env.LOCALAPPDATA;
  const userProfile = process.env.USERPROFILE;

  try {
    delete process.env.LOCALAPPDATA;
    delete process.env.USERPROFILE;
    assert.throws(() => dataDir(), /cannot determine the lyt data directory/);
  } finally {
    if (localAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = localAppData;
    if (userProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = userProfile;
  }
});
