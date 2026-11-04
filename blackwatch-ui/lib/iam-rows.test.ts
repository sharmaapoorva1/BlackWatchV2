import assert from "node:assert/strict";
import test from "node:test";

import { exposureDetail, sgDetail, toIamPostureRow, toIamRow } from "./iam-rows.ts";

const base = { event_id: "e1", event_time: "2026-11-04T06:11:00Z" };
const text = (segments: { text: string }[]) => segments.map((s) => s.text).join("");

test("SG detail joins target, port range, source and flags with separators", () => {
  const segments = sgDetail(
    {
      ...base,
      action: "network.sg.authorize_ingress",
      target: { id: "sg-123" },
      extra: { port: 22, to_port: 25, proto: "tcp", cidr: "0.0.0.0/0", public_ingress_risky_port: true },
    },
    "fallback",
  );
  assert.equal(text(segments), "sg-123 · tcp/22–25 · from 0.0.0.0/0 · ⚠ public risky port");
  assert.equal(segments.at(-1)?.tone, "critical");
});

test("SG instance attach lists the attached groups", () => {
  const segments = sgDetail(
    { ...base, action: "network.sg.instance_attach", target: { id: "i-1" }, extra: { sg_ids: ["sg-1", "sg-2"] } },
    "x",
  );
  assert.equal(text(segments), "i-1 · attached 2 SGs: sg-1, sg-2");
});

test("SG detail falls back to the target when there is nothing to show", () => {
  assert.equal(text(sgDetail({ ...base, action: "network.sg.delete" }, "the-fallback")), "the-fallback");
});

test("exposure detail lists every flag after the target", () => {
  const segments = exposureDetail(
    { ...base, action: "storage.s3.acl.put", target: { id: "my-bucket" }, extra: { public_acl: true, bpa_weakened: true } },
    "x",
  );
  assert.equal(text(segments), "my-bucket · public ACL · BPA weakened");
  assert.equal(segments[1].tone, "critical");
  assert.equal(text(exposureDetail({ ...base, action: "x", target: { id: "b" } }, "x")), "b");
});

test("login kind defaults to iam and is lower-cased", () => {
  assert.equal(toIamRow({ ...base, action: "auth.console.login" }).login_kind, "iam");
  assert.equal(toIamRow({ ...base, action: "auth.console.login", extra: { login_kind: "ROOT" } }).login_kind, "root");
});

test("posture rows read the finding extras", () => {
  const row = toIamPostureRow({
    ...base,
    action: "aws.posture.finding",
    extra: { finding_id: "f1", finding_type: "s3_public", region: "us-west-1", resource_id: "bucket-a" },
  });
  assert.equal(row.finding_id, "f1");
  assert.equal(row.finding_type, "s3_public");
  assert.equal(toIamPostureRow({ ...base, action: "x" }).finding_id, null);
});
