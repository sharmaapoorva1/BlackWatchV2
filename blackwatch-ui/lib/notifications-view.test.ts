import assert from "node:assert/strict";
import test from "node:test";

import { brokenChannels, buildNotificationCards, countSince, coverageTotals, groupRoutes } from "./notifications-view.ts";

const now = Date.parse("2026-11-05T12:00:00Z");
const log = [
  { status: "sent", ts: "2026-11-05T11:00:00Z" },
  { status: "failed", ts: "2026-11-05T10:00:00Z" },
  { status: "failed", ts: "2026-11-01T10:00:00Z" },
];
const cov = (gap: number, events: number) => ({
  event_count: events,
  gap_count: gap,
  content_gap_count: 0,
  counts: { configured: 1, fallback: 0, muted: 0, unconfigured: events - 1 },
});

test("counts only the window", () => {
  assert.equal(countSince(log, "failed", 24 * 3600 * 1000, now), 1);
  assert.equal(countSince(log, "sent", 24 * 3600 * 1000, now), 1);
});

test("only enabled channels with a bad last send are broken", () => {
  assert.equal(brokenChannels([{ enabled: true, last_status: "ok" }, { enabled: true, last_status: "error" }, { enabled: false, last_status: "error" }, { enabled: true, last_status: null }]), 1);
});

test("coverage totals add up", () => {
  const t = coverageTotals([cov(2, 5), cov(1, 3)]);
  assert.deepEqual([t.events, t.gaps, t.configured, t.unconfigured], [8, 3, 2, 6]);
});

test("routes group by module in first-seen order", () => {
  const groups = groupRoutes([{ module: "vpn" }, { module: null }, { module: "vpn" }, { module: "iam" }]);
  assert.deepEqual(groups.map((g) => [g.label, g.routes.length]), [["vpn", 2], ["Custom / advanced", 1], ["iam", 1]]);
});

test("cards escalate failures, broken channels and gaps", () => {
  const by = Object.fromEntries(
    buildNotificationCards({ channels: [{ enabled: true, last_status: "error" }], log, acks: [{ fingerprint: "a" }], coverage: [cov(2, 5)], now }).map((c) => [c.id, c]),
  );
  assert.equal(by.failed.tone, "critical");
  assert.equal(by.failed.of, "of 2 in 24h");
  assert.equal(by.channels.tone, "critical");
  assert.equal(by.gaps.tone, "high");
  assert.equal(by.paused.href, "#paused");
});

test("no channels is a warning, a quiet setup is ok", () => {
  const none = Object.fromEntries(buildNotificationCards({ channels: [], log: [], acks: [], coverage: [], now }).map((c) => [c.id, c]));
  assert.equal(none.channels.tone, "high");
  assert.equal(none.failed.tone, "ok");
  assert.equal(none.paused.href, "#routes");
  assert.equal(none.gaps.ratio, null);
});
