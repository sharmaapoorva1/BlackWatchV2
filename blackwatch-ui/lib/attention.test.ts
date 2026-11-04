import assert from "node:assert/strict";
import test from "node:test";

import { buildAttentionItems, isSystemItem } from "./attention.ts";

const quietOverview = {
  hosts: { total: 4, reporting: 4, stale: 0 },
  posture: { total_open: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0, informational: 0 } },
  notable: [],
};

test("a quiet system produces no attention items", () => {
  assert.deepEqual(
    buildAttentionItems({
      overview: quietOverview,
      connectors: { connectors: [] },
      ingress: { metrics: { quarantined: 0, retrying: 0 } },
    }),
    [],
  );
});

test("items are ranked critical before high before medium", () => {
  const items = buildAttentionItems({
    overview: {
      ...quietOverview,
      hosts: { total: 4, reporting: 3, stale: 1 },
      posture: { total_open: 3, by_severity: { critical: 1, high: 2, medium: 0, low: 0, informational: 0 } },
    },
    ingress: { metrics: { quarantined: 2 } },
  });
  assert.deepEqual(items.map((item) => item.level), ["critical", "high", "high", "medium"]);
  assert.equal(items[0].id, "posture-critical");
});

test("only enabled failing or stale connectors are reported", () => {
  const items = buildAttentionItems({
    connectors: {
      connectors: [
        { id: "a", name: "cloudtrail", type: "x", enabled: true, verified: true, config: {}, last_run_at: null, last_status: "error", last_error: null, health_state: "failing" },
        { id: "b", name: "disabled-one", type: "x", enabled: false, verified: true, config: {}, last_run_at: null, last_status: "error", last_error: null, health_state: "failing" },
        { id: "c", name: "ec2", type: "x", enabled: true, verified: true, config: {}, last_run_at: null, last_status: "ok", last_error: null, health_state: "stale" },
      ],
    },
  });
  assert.deepEqual(items.map((item) => item.id), ["connectors-failing", "connectors-stale"]);
  assert.match(items[0].title, /^1 connector failing$/);
});

test("system items exclude detection items", () => {
  const items = buildAttentionItems({
    overview: {
      ...quietOverview,
      posture: { total_open: 1, by_severity: { critical: 1, high: 0, medium: 0, low: 0, informational: 0 } },
      hosts: { total: 2, reporting: 1, stale: 1 },
    },
  });
  assert.deepEqual(items.filter(isSystemItem).map((item) => item.id), ["hosts-stale"]);
});

test("unavailable ingest metrics are ignored", () => {
  assert.deepEqual(
    buildAttentionItems({ ingress: { metrics: { available: false, quarantined: 5 } } }),
    [],
  );
});
