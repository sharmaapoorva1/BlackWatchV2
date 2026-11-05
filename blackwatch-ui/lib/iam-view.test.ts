import assert from "node:assert/strict";
import test from "node:test";

import { buildIamCards, failedLoginTone } from "./iam-view.ts";
import type { IamCounts } from "./types.ts";

const zero: IamCounts = {
  logins_ok: 10, logins_failed: 0, logins_root: 0, logins_sso: 4, iam_changes: 0, mfa_disabled: 0,
  sg_changes: 0, network_topology: 0, kms_changes: 0, storage_exposure: 0, ct_tamper: 0, posture_findings_new: 0,
};
const by = (counts: IamCounts) => Object.fromEntries(buildIamCards(counts).map((c) => [c.id, c]));

test("failed-login tone escalates at five", () => {
  assert.equal(failedLoginTone(0), "ok");
  assert.equal(failedLoginTone(4), "medium");
  assert.equal(failedLoginTone(5), "critical");
});

test("a quiet account is all ok", () => {
  const cards = buildIamCards(zero);
  assert.ok(cards.filter((c) => c.id !== "changes").every((c) => c.tone === "ok"));
  assert.equal(by(zero).failed.ratio, 0);
});

test("root, MFA, exposure and tamper are critical when present", () => {
  const c = by({ ...zero, logins_root: 1, mfa_disabled: 1, storage_exposure: 2, ct_tamper: 1, logins_failed: 5, iam_changes: 2, sg_changes: 1 });
  for (const id of ["root", "mfa", "exposure", "tamper", "failed"]) assert.equal(c[id].tone, "critical", id);
  assert.equal(c.changes.value, "3");
  assert.equal(c.failed.of, "of 15 sign-ins");
});

test("no sign-ins at all gives no ratio", () => {
  assert.equal(by({ ...zero, logins_ok: 0 }).failed.ratio, null);
});
