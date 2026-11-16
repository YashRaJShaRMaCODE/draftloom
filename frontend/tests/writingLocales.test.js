import test from "node:test";
import assert from "node:assert/strict";
import { WRITING_LOCALES } from "../src/utils/writingLocales.js";

test("writing locale options are unique and default to international English", () => {
  const values = WRITING_LOCALES.map(({ value }) => value);
  assert.equal(new Set(values).size, values.length);
  assert.equal(values[0], "international");
  assert.deepEqual(values, ["international", "india", "uk", "us"]);
});
