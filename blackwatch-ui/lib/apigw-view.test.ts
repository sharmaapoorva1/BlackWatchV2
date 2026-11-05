import assert from "node:assert/strict";
import test from "node:test";

import { buildApiGwCards, errorRate } from "./apigw-view.ts";

const s = { sources: 4, requests: 1000, err_4xx: 50, err_5xx: 0, last_activity: "2026-11-01T00:00:00Z" };

test("error rate is a share of requests, null without traffic", () => {
  assert.equal(errorRate(s, "err_4xx"), 0.05);
  assert.equal(errorRate({ ...s, requests: 0 }, "err_4xx"), null);
});

test("cards: alerts and 5xx escalate, quiet traffic is ok", () => {
  const by = (cards: ReturnType<typeof buildApiGwCards>) => Object.fromEntries(cards.map((c) => [c.id, c]));
  const quiet = by(buildApiGwCards(s, 0, 24, 0, 24));
  assert.equal(quiet.alerts.tone, "ok");
  assert.equal(quiet["5xx"].tone, "ok");
  assert.equal(quiet["4xx"].tone, "medium");
  assert.equal(quiet.sources.value, "4");
  const bad = by(buildApiGwCards({ ...s, err_5xx: 3 }, 2, 24, 7, 24));
  assert.equal(bad.alerts.tone, "high");
  assert.equal(bad["5xx"].tone, "critical");
  assert.equal(bad["4xx"].detail, "7 auth or server failures in the last 24h.");
  assert.equal(by(buildApiGwCards({ ...s, requests: 0, sources: 0, err_4xx: 0, last_activity: null }, 0, 24, 0, 24)).sources.detail, "No traffic yet.");
});
