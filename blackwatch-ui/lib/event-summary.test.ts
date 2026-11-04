import assert from "node:assert/strict";
import test from "node:test";

import { summarizeAction, toEventTableRow } from "./event-summary.ts";

test("summarizes dotted actions into readable text", () => {
  assert.equal(summarizeAction("host.fim.modified"), "Host · file integrity modified");
  assert.equal(summarizeAction("iam.policy.attach"), "IAM · policy attach");
  assert.equal(summarizeAction("auth.console_login.failure"), "Auth · console login failure");
});

test("handles single segments and missing values", () => {
  assert.equal(summarizeAction("heartbeat"), "Heartbeat");
  assert.equal(summarizeAction(""), "Unknown event");
  assert.equal(summarizeAction(undefined), "Unknown event");
});

test("table rows keep only displayed fields and never the raw payload", () => {
  const row = toEventTableRow({
    event_id: "e1",
    event_time: "2026-11-04T06:11:00Z",
    action: "host.fim.modified",
    severity: "high",
    source: { module: "ec2.host", raw: { secret: "x".repeat(1000) } },
    actor: { principal: "root" },
    target: { id: "i-0abc", name: "web-1" },
    tags: { role: "Dev-NAT", env: "dev" },
  });
  assert.deepEqual(Object.keys(row).sort(), ["action", "actor", "event_id", "event_time", "module", "severity", "tags", "target"]);
  assert.equal(row.target, "Dev-NAT");
  assert.equal(row.module, "ec2.host");
  assert.deepEqual(row.tags, [["role", "Dev-NAT"], ["env", "dev"]]);
  assert.ok(!JSON.stringify(row).includes("secret"));
});

test("table rows tolerate missing optional fields", () => {
  const row = toEventTableRow({ event_id: "e2", event_time: "2026-11-04T06:11:00Z", action: "x.y" });
  assert.equal(row.severity, null);
  assert.equal(row.actor, "");
  assert.equal(row.target, "—");
  assert.deepEqual(row.tags, []);
});
