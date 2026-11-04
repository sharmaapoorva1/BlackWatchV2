import assert from "node:assert/strict";
import test from "node:test";

import { changeDetail, toHostActivityRow } from "./host-activity.ts";

const base = { event_id: "e1", event_time: "2026-11-04T06:11:00Z", action: "host.port.opened" };

test("describes port, fim and package changes in one line", () => {
  assert.equal(
    changeDetail({ ...base, extra: { port: 22, proto: "tcp", address: "0.0.0.0" } }),
    "port tcp/22 on 0.0.0.0",
  );
  assert.equal(
    changeDetail({ ...base, extra: { path: "/usr/bin/dig", change: "modified" } }),
    "/usr/bin/dig · modified",
  );
  assert.equal(
    changeDetail({ ...base, extra: { added_count: 3, removed_count: 1 } }),
    "+3 / −1 packages",
  );
  assert.equal(changeDetail(base), "—");
});

test("access rows carry outcome and actor, change rows carry detail", () => {
  const access = toHostActivityRow(
    { ...base, action: "host.ssh.login", outcome: "failure", actor: { principal: "root", source_ip: "203.0.113.9" }, target: { id: "i-0abc123" } },
    "Access",
  );
  assert.equal(access.outcome, "failure");
  assert.equal(access.principal, "root");
  assert.equal(access.source_ip, "203.0.113.9");
  assert.equal(access.host_id, "i-0abc123");
  assert.equal(access.detail, "");

  const change = toHostActivityRow({ ...base, extra: { unit: "sshd.service" }, target: { name: "web-1" } }, "Host change");
  assert.equal(change.outcome, null);
  assert.equal(change.detail, "sshd.service");
  assert.equal(change.host_id, null);
  assert.equal(change.host_label, "web-1");
});

test("role tag wins as the host label", () => {
  const row = toHostActivityRow({ ...base, extra: { tags: { role: "Dev-NAT" } }, target: { id: "i-0abc123" } }, "Host change");
  assert.equal(row.host_label, "Dev-NAT");
});
