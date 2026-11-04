import assert from "node:assert/strict";
import test from "node:test";

import { formatEpoch, toUebaAnomalyRow } from "./ueba-rows.ts";

test("anomaly rows read the UEBA extras and fall back to the actor", () => {
  const row = toUebaAnomalyRow({
    event_id: "e1",
    event_time: "2026-11-04T06:11:00Z",
    action: "ueba.anomaly.first_seen_ip",
    actor: { principal: "alice", type: "user" },
    extra: { dimension: "source_ip", baseline_value: "203.0.113.9", trigger_event_id: "t1" },
  });
  assert.equal(row.principal_id, "alice");
  assert.equal(row.principal_type, "user");
  assert.equal(row.dimension, "source_ip");
  assert.equal(row.value, "203.0.113.9");
  assert.equal(row.trigger_event_id, "t1");
});

test("anomaly rows tolerate missing extras", () => {
  const row = toUebaAnomalyRow({ event_id: "e2", event_time: "2026-11-04T06:11:00Z", action: "x" });
  assert.equal(row.principal_id, "");
  assert.equal(row.trigger_event_id, "");
});

test("epoch seconds format as UTC and zero is blank", () => {
  assert.equal(formatEpoch(0), "");
  assert.equal(formatEpoch(1_700_000_000), "2023-11-14 22:13:20Z");
});
