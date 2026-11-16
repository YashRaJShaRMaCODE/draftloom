import test from "node:test";
import assert from "node:assert/strict";
import { markdownResult } from "../src/utils/markdownExport.js";

test("Markdown export keeps the result as readable text", () => {
  assert.equal(markdownResult("  Hello **team**.  "), "# Clear Writing result\n\nHello **team**.\n");
  assert.equal(markdownResult("  "), "");
});
