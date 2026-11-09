import assert from "node:assert/strict";
import test from "node:test";

import { buildConnectorCards, connectorCounts, connectorGroup, connectorState, filterConnectors, parseConnectorGroup } from "./connectors-view.ts";

const c = (over: Record<string, unknown>) => ({ name: "n", enabled: true, verified: true, last_status: "ok", ...over }) as Parameters<typeof connectorState>[0] & { name: string };

test("state prefers the server value, else derives it", () => {
  assert.equal(connectorState(c({ health_state: "stale" })), "stale");
  assert.equal(connectorState(c({ enabled: false })), "disabled");
  assert.equal(connectorState(c({ verified: false })), "unverified");
  assert.equal(connectorState(c({ last_status: "error" })), "failing");
  assert.equal(connectorState(c({ last_status: null })), "never_run");
  assert.equal(connectorState(c({})), "healthy");
});

test("states fall into attention, healthy or disabled", () => {
  for (const s of ["failing", "stale", "unverified", "never_run"]) assert.equal(connectorGroup(c({ health_state: s })), "attention", s);
  for (const s of ["healthy", "running"]) assert.equal(connectorGroup(c({ health_state: s })), "healthy", s);
  assert.equal(connectorGroup(c({ enabled: false })), "disabled");
});

test("param validation and counts", () => {
  assert.equal(parseConnectorGroup("healthy"), "healthy");
  assert.equal(parseConnectorGroup("x"), "");
  assert.deepEqual(connectorCounts([c({}), c({ last_status: "error" }), c({ enabled: false }), c({ verified: false })]), { attention: 2, healthy: 1, disabled: 1, failing: 1 });
});

test("failing connectors sort first within attention", () => {
  const list = [c({ name: "a", verified: false }), c({ name: "b", last_status: "error" })];
  assert.deepEqual(filterConnectors(list, "attention").map((x) => x.name), ["b", "a"]);
  assert.equal(filterConnectors(list, "healthy").length, 0);
  assert.equal(filterConnectors(list, "").length, 2);
});

test("cards escalate failing connectors and link to the filtered list", () => {
  const by = Object.fromEntries(buildConnectorCards([c({}), c({ last_status: "error" })]).map((x) => [x.id, x]));
  assert.equal(by.attention.tone, "critical");
  assert.equal(by.attention.href, "/connectors?health=attention#connectors");
  assert.equal(by.healthy.tone, "ok");
  const none = Object.fromEntries(buildConnectorCards([]).map((x) => [x.id, x]));
  assert.equal(none.attention.tone, "ok");
  assert.equal(none.attention.of, undefined);
});
