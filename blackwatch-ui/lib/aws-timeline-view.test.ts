import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAwsTimelineCards,
  collapseRuns,
  dayCells,
  eventsToCsv,
  groupByDay,
  isFailed,
  isFlagged,
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

test("only a real failure counts as failed; unknown does not", () => {
  assert.equal(isFailed({ outcome: "failure" }), true);
  assert.equal(isFailed({ outcome: "unknown" }), false);
  assert.equal(isFailed({ outcome: "success" }), false);
  assert.equal(isFailed({}), false);
});

test("identical neighbours fold into one run, a different event splits it", () => {
  const login = (id: string, t: string, ip = "198.51.100.1") =>
    ev(id, t, { action: "auth.console.login", actor: { principal: "alice", source_ip: ip } });
  const runs = collapseRuns([
    login("1", "2026-11-25T10:00:00Z"),
    login("2", "2026-11-25T09:00:00Z"),
    ev("3", "2026-11-25T08:00:00Z", { action: "iam.user.create" }),
    login("4", "2026-11-25T07:00:00Z"),
    login("5", "2026-11-25T06:00:00Z", "203.0.113.9"),
  ]);
  assert.deepEqual(runs.map((r) => r.events.length), [2, 1, 1, 1]);
  assert.deepEqual(runs[0].events.map((e) => e.event_id), ["1", "2"]);
});

test("flagged means scored or failed", () => {
  assert.equal(isFlagged(ev("a", "2026-11-25T10:00:00Z", { severity: "high" })), true);
  assert.equal(isFlagged(ev("b", "2026-11-25T10:00:00Z", { outcome: "failure" })), true);
  assert.equal(isFlagged(ev("c", "2026-11-25T10:00:00Z")), false);
});

test("day cells cover every day in the window, zeros included", () => {
  const now = new Date(2026, 10, 25, 12, 0, 0); // local 25 Nov
  const key = (e: EventEnvelope) => e.event_id;
  const cells = dayCells(
    [ev("2026-11-25", "x", { severity: "high" }), ev("2026-11-23", "x"), ev("2026-11-23", "x")],
    3,
    key,
    now,
  );
  assert.deepEqual(cells.map((c) => c.day), ["2026-11-23", "2026-11-24", "2026-11-25"]);
  assert.deepEqual(cells.map((c) => c.count), [2, 0, 1]);
  assert.equal(cells[2].flagged, 1);
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
