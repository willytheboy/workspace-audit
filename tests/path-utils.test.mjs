import assert from "node:assert/strict";
import { resolve } from "node:path";
import { isWithin } from "../lib/path-utils.mjs";

export function pathUtilsTest() {
  const baseDir = resolve("C:\\workspace\\audit");
  const childPath = resolve(baseDir, "alpha", "src");
  const escapedPath = resolve(baseDir, "..", "outside");

  assert.equal(isWithin(baseDir, childPath), true);
  assert.equal(isWithin(baseDir, escapedPath), false);
}
