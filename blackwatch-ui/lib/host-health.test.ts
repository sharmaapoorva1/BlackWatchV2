import assert from "node:assert/strict";
import test from "node:test";

import {
  attentionReasons,
  buildFleetCards,
  environmentCounts,
  fleetCounts,
  hostGroup,
  hostState,
  parseFleetGroup,
} from "./host-health.ts";
import type { HostSummary } from "./types.ts";

const host = (over: Partial<HostSummary> & { id?: string }): HostSummary =>
  ({
    instance_id: over.id ?? "i-1",
    hostname: null,
    display_name: null,
    account: null,
    region: null,
    active: true,
    age_seconds: 10,
    stale: false,
    updated_at: null,
    tags: null,
    port_count: 0,
    user_count: 0,
    key_count: 0,
    ...over,
  }) as HostSummary;

test("state falls back to staleness and a stale 'healthy' host counts as silent", () => {
  assert.equal(hostState(host({})), "healthy");
  assert.equal(hostState(host({ stale: true })), "silent");
  assert.equal(hostState(host({ active: false })), "silent");
  assert.equal(hostState(host({ health_state: "healthy", stale: true })), "silent");
  assert.equal(hostState(host({ health_state: "collector_degraded" })), "collector_degraded");
});

test("groups: healthy, attention (reporting but unwell), silent", () => {
  assert.equal(hostGroup(host({})), "healthy");
  assert.equal(hostGroup(host({ health_state: "delivery_delayed" })), "attention");
  assert.equal(hostGroup(host({ health_state: "silent" })), "silent");
  assert.equal(hostGroup(host({ health_state: "delivery_delayed", stale: true })), "silent");
});

const fleet = [
  host({ id: "a" }),
  host({ id: "b" }),
  host({ id: "c", health_state: "delivery_delayed" }),
  host({ id: "d", health_state: "delivery_delayed" }),
  host({ id: "e", health_state: "collector_degraded" }),
  host({ id: "f", stale: true }),
];

test("counts and the reasons behind the attention group", () => {
  assert.deepEqual(fleetCounts(fleet), { healthy: 2, attention: 3, silent: 1 });
  assert.equal(attentionReasons(fleet), "2 delivery delayed, 1 collector degraded");
  assert.equal(attentionReasons([host({})]), "");
});

test("fleet cards link to the filtered table and describe the problem", () => {
  const cards = buildFleetCards(fleet, { metrics: { quarantined: 0, retrying: 0 } });
  const by = Object.fromEntries(cards.map((card) => [card.id, card]));
  assert.equal(by.healthy.value, "2");
  assert.equal(by.healthy.of, "of 6");
  assert.equal(by.healthy.href, "/hosts?health=healthy#fleet");
  assert.equal(by.attention.tone, "medium");
  assert.equal(by.attention.detail, "2 delivery delayed, 1 collector degraded.");
  assert.equal(by.silent.tone, "critical");
  assert.equal(by.silent.href, "/hosts?health=silent#fleet");
  assert.equal(by.ingestion.tone, "ok");
});

test("a perfectly healthy fleet is all ok, and an empty fleet is neutral", () => {
  const ok = buildFleetCards([host({}), host({ id: "b" })], { metrics: {} });
  assert.deepEqual(ok.slice(0, 3).map((card) => card.tone), ["ok", "ok", "ok"]);
  const empty = buildFleetCards([], null);
  assert.equal(empty[0].tone, "neutral");
  assert.equal(empty[0].detail, "No hosts have reported yet.");
  assert.equal(empty[3].value, "—");
});

test("health param is validated and environments are counted biggest first", () => {
  assert.equal(parseFleetGroup("attention"), "attention");
  assert.equal(parseFleetGroup("nonsense"), "");
  assert.equal(parseFleetGroup(undefined), "");
  const envs = environmentCounts([host({ tags: { env: "prod" } }), host({ id: "b", tags: { env: "prod" } }), host({ id: "c", tags: { env: "dev" } }), host({ id: "d" })]);
  assert.deepEqual(envs, [
    { env: "prod", count: 2 },
    { env: "dev", count: 1 },
    { env: "untagged", count: 1 },
  ]);
});
