import assert from "node:assert/strict";
import test from "node:test";

import { buildHealthCards, fmtCount, severityBreakdown, sumServiceCounts } from "./overview.ts";
import { buildAttentionItems } from "./attention.ts";
import type { Connector, OverviewResponse, ServiceCounts } from "./types.ts";

const overview = (over: Partial<OverviewResponse> = {}): OverviewResponse => ({
  now: "2026-11-05T00:00:00Z",
  severity_counts: {},
  notable: [],
  recent: [],
  volume_24h: 1234,
  hosts: { total: 4, reporting: 4, stale: 0 },
  posture: { total_open: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0, informational: 0 } },
  ...over,
});

const counts = (c: Partial<ServiceCounts>): ServiceCounts => ({ total: 0, up: 0, down: 0, degraded: 0, unknown: 0, disabled: 0, ...c });
const connector = (health: string, enabled = true) => ({ id: health, name: health, enabled, health_state: health }) as unknown as Connector;
const card = (cards: ReturnType<typeof buildHealthCards>, id: string) => cards.find((c) => c.id === id)!;

test("count formatting stays short", () => {
  assert.equal(fmtCount(999), "999");
  assert.equal(fmtCount(1234), "1.2k");
  assert.equal(fmtCount(54_321), "54k");
  assert.equal(fmtCount(2_500_000), "2.5M");
});

test("service counts are summed across VPCs", () => {
  const total = sumServiceCounts({ a: counts({ total: 3, up: 2, down: 1 }), b: counts({ total: 2, up: 2 }) });
  assert.deepEqual(total, counts({ total: 5, up: 4, down: 1 }));
});

test("a healthy platform shows every card ok", () => {
  const cards = buildHealthCards({
    overview: overview(),
    connectors: { connectors: [connector("healthy")] },
    ingress: { metrics: { quarantined: 0, retrying: 0, processing_p95_seconds: 1.234 } },
    services: { a: counts({ total: 3, up: 3 }) },
  });
  for (const id of ["hosts", "services", "connectors", "ingestion", "posture"]) {
    assert.equal(card(cards, id).tone, "ok", id);
  }
  assert.equal(card(cards, "hosts").value, "4");
  assert.equal(card(cards, "hosts").of, "of 4");
  assert.equal(card(cards, "ingestion").detail, "Processing p95 1.2s.");
  assert.equal(card(cards, "volume").value, "1.2k");
});

test("problems raise the right tone and say what is wrong", () => {
  const cards = buildHealthCards({
    overview: overview({
      hosts: { total: 4, reporting: 1, stale: 3 },
      posture: { total_open: 3, by_severity: { critical: 1, high: 1, medium: 1, low: 0, informational: 0 } },
    }),
    connectors: { connectors: [connector("healthy"), connector("failing"), connector("stale"), connector("failing", false)] },
    ingress: { metrics: { quarantined: 2, retrying: 1 } },
    services: { a: counts({ total: 5, up: 3, down: 1, degraded: 1 }) },
  });
  assert.equal(card(cards, "hosts").tone, "high");
  assert.equal(card(cards, "hosts").detail, "3 hosts are not reporting.");
  assert.equal(card(cards, "services").tone, "critical");
  assert.equal(card(cards, "services").detail, "1 down, 1 degraded.");
  assert.equal(card(cards, "connectors").tone, "high");
  assert.equal(card(cards, "connectors").of, "of 3");
  assert.equal(card(cards, "ingestion").tone, "high");
  assert.equal(card(cards, "posture").tone, "critical");
  assert.equal(card(cards, "posture").segments?.[0].count, 1);
});

test("a signal that failed to load never looks healthy", () => {
  const cards = buildHealthCards({ overview: overview(), connectors: null, ingress: null, services: null });
  for (const id of ["connectors", "services", "ingestion"]) {
    assert.equal(card(cards, id).value, "—", id);
    assert.equal(card(cards, id).tone, "neutral", id);
  }
});

test("severity breakdown is fixed-order with bars relative to the largest", () => {
  const rows = severityBreakdown({ critical: 2, high: 10, informational: 5 });
  assert.deepEqual(rows.map((row) => row.key), ["critical", "high", "medium", "low", "informational", "unscored"]);
  assert.equal(rows[1].ratio, 1);
  assert.equal(rows[0].ratio, 0.2);
  assert.equal(rows[2].count, 0);
});

test("attention: services down and honest wording for the recent-events list", () => {
  const items = buildAttentionItems({
    overview: overview({ notable: new Array(10).fill({ event_id: "x", event_time: "", action: "a" }) }),
    services: { down: 2, degraded: 1, total: 9 },
  });
  assert.equal(items.find((item) => item.id === "notable-events")?.title, "10+ recent high or critical events");
  assert.equal(items.find((item) => item.id === "services-down")?.title, "2 services down, 1 degraded");
  assert.equal(items.find((item) => item.id === "services-down")?.level, "high");
});
