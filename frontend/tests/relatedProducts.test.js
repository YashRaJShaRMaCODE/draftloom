import test from "node:test";
import assert from "node:assert/strict";
import { requestRelatedProducts, safeLeadHubOrigin } from "../src/utils/relatedProducts.js";

test("accepts only an HTTPS LeadHub origin", () => {
  assert.equal(safeLeadHubOrigin("https://leads.example.test/"), "https://leads.example.test");
  assert.equal(safeLeadHubOrigin("http://leads.example.test"), "");
  assert.equal(safeLeadHubOrigin("https://leads.example.test/path"), "");
});

test("requests recommendations only after consent and filters unsafe links", async () => {
  let requested = "";
  const fetcher = async (url) => {
    requested = url;
    return { ok: true, json: async () => ({ items: [
      { id: "applypost", name: "ApplyPost", url: "https://jobs.example.test/", reason: "Job workflows" },
      { id: "bad", name: "Bad", url: "javascript:alert(1)", reason: "Unsafe" },
    ] }) };
  };
  assert.deepEqual(await requestRelatedProducts("https://leads.example.test", "draftloom", false, fetcher), []);
  assert.equal(requested, "");
  const items = await requestRelatedProducts("https://leads.example.test", "draftloom", true, fetcher);
  assert.equal(requested, "https://leads.example.test/api/recommendations?project=draftloom&consent=true");
  assert.deepEqual(items.map(({ id }) => id), ["applypost"]);
});
