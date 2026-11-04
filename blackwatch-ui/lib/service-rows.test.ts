import assert from "node:assert/strict";
import test from "node:test";

import { formatDownDuration, toServiceRow } from "./service-rows.ts";
import type { ServiceTarget } from "./types.ts";

const NOW = Date.parse("2026-11-04T12:00:00Z");

test("down durations read in days, hours or minutes", () => {
  assert.equal(formatDownDuration("2026-11-01T09:00:00Z", NOW), "3d 3h");
  assert.equal(formatDownDuration("2026-11-01T12:00:00Z", NOW), "3d");
  assert.equal(formatDownDuration("2026-11-04T09:00:00Z", NOW), "3h");
  assert.equal(formatDownDuration("2026-11-04T11:45:00Z", NOW), "15m");
  assert.equal(formatDownDuration(null, NOW), "—");
  assert.equal(formatDownDuration("not a date", NOW), "—");
  assert.equal(formatDownDuration("2026-11-05T12:00:00Z", NOW), "0m");
});

test("service rows drop config and keep tags as pairs", () => {
  const row = toServiceRow(
    {
      id: "s1",
      name: "api",
      vpc: "prod",
      tier: "web",
      enabled: true,
      severity_when_down: "high",
      tags: { env: "prod" },
      status: "down",
      last_seen: null,
      age_seconds: 12,
      stale: false,
      latency_ms: 40,
      consecutive_fails: 3,
      down_since: "2026-11-04T11:00:00Z",
      config: { url: "https://internal.example/secret" },
    } as ServiceTarget,
    NOW,
  );
  assert.ok(!JSON.stringify(row).includes("secret"));
  assert.deepEqual(row.tags, [["env", "prod"]]);
  assert.equal(row.down_for, "1h");
  assert.equal(row.down_since_ms, Date.parse("2026-11-04T11:00:00Z"));
});
