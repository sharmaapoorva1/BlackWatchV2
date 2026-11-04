import assert from "node:assert/strict";
import test from "node:test";

import { connectorDetails, connectorStatus, toConnectorRow } from "./connector-rows.ts";
import type { Connector } from "./types.ts";

function connector(overrides: Partial<Connector>): Connector {
  return {
    id: "c1",
    name: "cloudtrail",
    type: "aws_cloudtrail_sqs",
    enabled: true,
    verified: true,
    config: {},
    last_run_at: null,
    last_status: null,
    last_error: null,
    ...overrides,
  } as Connector;
}

test("details are composed from non-sensitive config only", () => {
  assert.equal(
    connectorDetails({ type: "aws_cloudtrail_sqs", config: { aws_region: "us-west-1", target_module: "ec2.host" } }),
    "us-west-1 · ec2.host",
  );
  assert.equal(connectorDetails({ type: "aws_posture_drift", config: { regions: ["us-west-1", "us-east-1"] } }), "us-west-1,us-east-1 · instance role credentials");
  assert.equal(connectorDetails({ type: "cert_probe", config: { targets: [1], interval_seconds: 600 } }), "1 target · every 600s");
  assert.equal(connectorDetails({ type: "unknown", config: {} }), "—");
});

test("rows never carry the connector config", () => {
  const row = toConnectorRow(
    connector({ config: { queue_url: "https://sqs.example/secret-queue", interval_seconds: 60 } }),
  );
  assert.ok(!JSON.stringify(row).includes("secret-queue"));
  assert.equal(row.interval_seconds, "60");
});

test("status prefers an in-flight operation, then health, then failures", () => {
  assert.deepEqual(
    connectorStatus({ latest_operation: { status: "running" } as Connector["latest_operation"], health_state: "healthy", last_status: "ok" }),
    { severity: "neutral", label: "running" },
  );
  assert.deepEqual(connectorStatus({ health_state: "healthy", last_status: null }), { severity: "resolved", label: "healthy" });
  assert.deepEqual(
    connectorStatus({ latest_operation: { status: "timed_out" } as Connector["latest_operation"], health_state: undefined, last_status: "error" }),
    { severity: "critical", label: "timed out" },
  );
  assert.deepEqual(connectorStatus({ health_state: "stale", last_status: null }), { severity: "medium", label: "stale" });
  assert.deepEqual(connectorStatus({ last_status: null }), { severity: "neutral", label: "never run" });
});

test("error text includes category and a short correlation reference", () => {
  const row = toConnectorRow(
    connector({
      last_error: "old",
      latest_operation: {
        status: "failed",
        error_message: "AccessDenied",
        error_category: "auth",
        correlation_id: "abcdef1234567890",
      } as Connector["latest_operation"],
    }),
  );
  assert.equal(row.error, "auth: AccessDenied · ref abcdef12");
  assert.equal(toConnectorRow(connector({ last_error: "boom" })).error, "last error: boom");
  assert.equal(toConnectorRow(connector({})).error, null);
});
