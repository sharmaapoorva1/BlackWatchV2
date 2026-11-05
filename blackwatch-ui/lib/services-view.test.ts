import assert from "node:assert/strict";
import test from "node:test";

import {
  buildServiceCards,
  filterGrouped,
  needsAttention,
  parseStatusFilter,
  vpcStartsOpen,
  vpcSummary,
} from "./services-view.ts";
import type { ProbeAgent, ServiceCounts, ServiceTarget } from "./types.ts";

const svc = (id: string, status: string, over: Partial<ServiceTarget> = {}): ServiceTarget =>
  ({ id, name: id, vpc: "prod", tier: "web", enabled: true, severity_when_down: "high", tags: null, status, last_seen: null, age_seconds: null, stale: false, latency_ms: null, consecutive_fails: 0, down_since: null, ...over }) as ServiceTarget;
const counts = (c: Partial<ServiceCounts>): ServiceCounts => ({ total: 0, up: 0, down: 0, degraded: 0, unknown: 0, disabled: 0, ...c });
const agent = (vpc: string, active: boolean | null): ProbeAgent => ({ vpc, active, agent_version: "1", last_report: null });

test("status filter is validated", () => {
  assert.equal(parseStatusFilter("down"), "down");
  assert.equal(parseStatusFilter("bogus"), "");
  assert.equal(parseStatusFilter(undefined), "");
});

test("filtering keeps matching services and drops empty VPCs", () => {
  const grouped = { prod: [svc("a", "up"), svc("b", "down")], dev: [svc("c", "up")] };
  assert.deepEqual(Object.keys(filterGrouped(grouped, "down")), ["prod"]);
  assert.equal(filterGrouped(grouped, "down").prod.length, 1);
  assert.equal(filterGrouped(grouped, ""), grouped);
});

test("the attention list is worst first, then longest outage first", () => {
  const grouped = {
    prod: [
      svc("up-1", "up"),
      svc("unknown-1", "unknown"),
      svc("degraded-1", "degraded"),
      svc("down-new", "down", { down_since: "2026-11-04T00:00:00Z" }),
      svc("down-old", "down", { down_since: "2026-11-01T00:00:00Z" }),
      svc("disabled-1", "disabled"),
    ],
  };
  assert.deepEqual(needsAttention(grouped).map((s) => s.id), ["down-old", "down-new", "degraded-1", "unknown-1"]);
});

test("VPC summary lists only non-zero parts; problem VPCs start open, healthy ones fold when many", () => {
  assert.equal(vpcSummary(counts({ total: 5, up: 3, down: 1, unknown: 1 })), "3 up · 1 down · 1 unknown");
  assert.equal(vpcSummary(undefined), "");
  assert.equal(vpcStartsOpen(counts({ up: 4, total: 4 }), 2), true);
  assert.equal(vpcStartsOpen(counts({ up: 4, total: 4 }), 6), false);
  assert.equal(vpcStartsOpen(counts({ up: 3, down: 1, total: 4 }), 6), true);
});

test("cards state the problem and link to the filtered list", () => {
  const cards = buildServiceCards({ prod: counts({ total: 6, up: 3, down: 1, degraded: 1, unknown: 1 }) }, [agent("prod", true), agent("dev", false)]);
  const by = Object.fromEntries(cards.map((card) => [card.id, card]));
  assert.equal(by.up.of, "of 6");
  assert.equal(by.down.tone, "critical");
  assert.equal(by.down.href, "/services?status=down#services");
  assert.equal(by.watch.value, "2");
  assert.equal(by.watch.detail, "1 degraded, 1 cannot be probed.");
  assert.equal(by.agents.tone, "medium");
  assert.match(by.agents.detail, /1 not reporting/);
});

test("a healthy or empty estate reads correctly", () => {
  const ok = buildServiceCards({ prod: counts({ total: 3, up: 3 }) }, [agent("prod", true)]);
  assert.deepEqual(ok.map((card) => card.tone), ["ok", "ok", "ok", "ok"]);
  const empty = buildServiceCards({}, []);
  assert.equal(empty[0].detail, "No probe targets configured.");
  assert.equal(empty[0].tone, "neutral");
  assert.equal(empty[3].tone, "neutral");
});
