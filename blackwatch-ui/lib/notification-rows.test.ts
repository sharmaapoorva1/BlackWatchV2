import assert from "node:assert/strict";
import test from "node:test";

import {
  computeRouteState,
  scopeLabel,
  toChannelRow,
  toMetricRouteRow,
} from "./notification-rows.ts";
import type { NotificationChannel, PerfAlertInstance, PerfAlertRule } from "./types.ts";

const label = (instance: PerfAlertInstance) => instance.display_name || instance.hostname || instance.instance_id;

function instance(id: string, name: string | null): PerfAlertInstance {
  return { instance_id: id, hostname: null, display_name: name } as PerfAlertInstance;
}

test("channel rows never carry config or templates", () => {
  const row = toChannelRow({
    id: "c1",
    name: "ops",
    type: "slack",
    enabled: true,
    config: { webhook_url: "https://hooks.slack.com/services/SECRET" },
    message_template: "{{ x }}",
    retries: 3,
    retry_backoff_seconds: 1,
    rate_limit_per_min: 10,
    dedup_window_seconds: 0,
    digest_window_seconds: 0,
    last_status: "ok",
    last_error: null,
    last_sent_at: null,
  } as NotificationChannel);
  assert.ok(!JSON.stringify(row).includes("SECRET"));
  assert.deepEqual(Object.keys(row).sort(), ["enabled", "id", "last_error", "last_sent_at", "last_status", "name", "type"]);
});

test("route state precedence: silenced, off, no channel, on", () => {
  assert.equal(computeRouteState({ silenced: true, enabled: false, channel: null }).label, "silenced");
  assert.equal(computeRouteState({ silenced: false, enabled: false, channel: "x" }).label, "off");
  assert.equal(computeRouteState({ silenced: false, enabled: true, channel: null }).label, "no channel");
  assert.equal(computeRouteState({ silenced: false, enabled: true, channel: "x" }).label, "on");
});

test("scope uses host names, compacts past three, and falls back to tags or all hosts", () => {
  const byId = new Map([
    ["i-1", instance("i-1", "web-1")],
    ["i-2", instance("i-2", "web-2")],
  ]);
  const base = { instance_ids: [], instance_id: null, tag_key: null, tag_value: null };
  assert.equal(scopeLabel({ ...base, instance_ids: ["i-1", "i-2", "i-9"] }, byId, label), "web-1, web-2, i-9");
  assert.equal(
    scopeLabel({ ...base, instance_ids: ["i-1", "i-2", "i-3", "i-4", "i-5"] }, byId, label),
    "web-1, web-2, i-3 +2 more",
  );
  assert.equal(scopeLabel({ ...base, instance_id: "i-1" }, byId, label), "web-1");
  assert.equal(scopeLabel({ ...base, tag_key: "env", tag_value: "prod" }, byId, label), "tag env=prod");
  assert.equal(scopeLabel(base, byId, label), "all hosts");
});

test("metric rows round the window to whole minutes, at least one", () => {
  const rule = {
    id: "r1",
    name: "cpu",
    enabled: true,
    metric: "cpu_utilization_pct",
    comparison: "gte",
    threshold: 80,
    window_seconds: 20,
    channels: ["ops"],
    instance_ids: [],
    instance_id: null,
    tag_key: null,
    tag_value: null,
  } as unknown as PerfAlertRule;
  const row = toMetricRouteRow(rule, new Map(), label);
  assert.equal(row.minutes, 1);
  assert.equal(row.scope, "all hosts");
  assert.deepEqual(row.channels, ["ops"]);
});
