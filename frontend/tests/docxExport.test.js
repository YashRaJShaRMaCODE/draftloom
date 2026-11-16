import test from "node:test";
import assert from "node:assert/strict";
import { docxResult } from "../src/utils/docxExport.js";

test("DOCX export creates a Word document and preserves paragraph breaks", async () => {
  const blob = await docxResult("First paragraph.\n\nSecond paragraph.");
  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.deepEqual(Array.from(new Uint8Array(await blob.slice(0, 2).arrayBuffer())), [0x50, 0x4b]);
});

test("DOCX export skips empty results", async () => {
  assert.equal(await docxResult("  "), null);
});
