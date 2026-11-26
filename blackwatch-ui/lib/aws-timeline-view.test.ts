import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAwsTimelineCards,
  eventsToCsv,
  groupByDay,
  parseAwsTimelineHours,
  parseAwsTimelineTab,
  toAwsActivityRow,
} from "./aws-timeline-view.ts";
import type { EventEnvelope } from "./types.ts";

const ev = (id: string, time: string, extra: Partial<EventEnvelope> = {}): EventEnvelope => ({
  event_id: id,
  event_time: time,
  action: "iam.user.create",
  outcome: "success",
  actor: { principal: "alice", source_ip: "203.0.113.5" },
  ...extra,
});

test("unknown tab and window fall back to safe defaults", () => {
  assert.equal(parseAwsTimelineTab("nope"), "all");
  assert.equal(parseAwsTimelineTab("critical"), "critical");
  assert.equal(parseAwsTimelineHours("9999", 24), 24);
  assert.equal(parseAwsTimelineHours("168", 24), 168);
});

test("cards mark root activity critical and zero counts ok", () => {
  const quiet = buildAwsTimelineCards({ counts: { critical: 0, high: 0, all: 5 }, users: [], hours: 24 });
  assert.equal(quiet[0].tone, "ok");
  assert.equal(quiet[1].tone, "ok");
  const root = buildAwsTimelineCards({
    counts: { critical: 2, high: 1, all: 9 },
    users: [{ principal: "root", events: 3, last_seen: "x", failed: 0, source_ips: 1, top_severity: "critical", is_root: true }],
    hours: 168,
  });
  assert.equal(root[0].tone, "critical");
  assert.equal(root[2].tone, "critical");
});

test("cards link to the matching tab and keep the chosen window", () => {
  const cards = buildAwsTimelineCards({ counts: { critical: 1, high: 0, all: 3 }, users: [], hours: 168 });
  assert.equal(cards[0].href, "/aws-timeline?tab=critical&hours=168#activity");
  assert.equal(cards[2].href, "/aws-timeline?tab=users&hours=168#activity");
});

test("activity row flags failures and tolerates missing fields", () => {
  const row = toAwsActivityRow(ev("x", "2026-11-25T10:00:00Z", { outcome: "failure", target: { id: "arn:t" } }));
  assert.equal(row.failed, true);
  assert.equal(row.target, "arn:t");
  assert.equal(row.severity, null);
  const bare = toAwsActivityRow({ event_id: "y", event_time: "2026-11-25T10:00:00Z", action: "a" });
  assert.equal(bare.failed, false);
  assert.equal(bare.principal, null);
});

test("csv is oldest first, quotes commas and neutralizes formulas", () => {
  const csv = eventsToCsv([
    ev("b", "2026-11-25T10:00:00Z", { action: "a,b" }),
    ev("a", "2026-11-25T09:00:00Z", { actor: { principal: "=cmd()" } }),
  ]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "time,user,action,outcome,severity,source_ip,target,region");
  assert.match(lines[1], /^2026-11-25T09:00:00Z,'=cmd\(\)/);
  assert.match(lines[2], /"a,b"/);
});

test("groupByDay buckets by UTC day, newest first", () => {
  const days = groupByDay([
    ev("1", "2026-11-24T23:00:00Z"),
    ev("2", "2026-11-25T01:00:00Z"),
    ev("3", "2026-11-25T05:00:00Z"),
  ]);
  assert.deepEqual(days.map((d) => d.day), ["2026-11-25", "2026-11-24"]);
  assert.deepEqual(days[0].events.map((e) => e.event_id), ["3", "2"]);
});
