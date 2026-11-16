import assert from "node:assert/strict";
import test from "node:test";
import { prepareBatchDrafts } from "../src/utils/batchReview.js";

test("batch review accepts two to five non-empty drafts", () => {
  const drafts = ["First update", "Second update", "", "Third update", "Fourth update", "Fifth update"];
  assert.deepEqual(prepareBatchDrafts(drafts), {
    drafts: drafts.filter(Boolean),
    error: "",
  });
});

test("batch review requires at least two drafts and caps each run at five", () => {
  assert.match(prepareBatchDrafts(["Only one"]).error, /at least two/);
  assert.match(prepareBatchDrafts(["one", "two", "three", "four", "five", "six"]).error, /up to 5/);
});

test("batch review enforces the per-draft limit and blocks detected personal details", () => {
  assert.match(prepareBatchDrafts(["x".repeat(6), "valid"], 5).error, /5 characters/);
  assert.match(prepareBatchDrafts(["Email me at person@example.com", "Second draft"]).error, /personal details/);
  assert.deepEqual(prepareBatchDrafts(["  First  ", "  Second  "]).drafts, ["First", "Second"]);
});
