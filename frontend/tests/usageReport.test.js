import test from "node:test";
import assert from "node:assert/strict";
import { workspaceUsageCsv } from "../src/utils/usageReport.js";

test("owner usage report exports counts and clearly marks unmeasured provider cost", () => {
  const csv = workspaceUsageCsv({
    role: "owner",
    name: 'Northstar, "Ops"',
    usage: { period: "2026-11", plan: "free", used: 4, limit: 100, seats: 3 },
  });
  assert.match(csv, /"Workspace","Northstar, ""Ops"""/);
  assert.match(csv, /"AI requests used","4"/);
  assert.match(csv, /"Provider cost","Not measured"/);
  assert.equal(workspaceUsageCsv({ role: "member", usage: { used: 4 } }), "");
});
