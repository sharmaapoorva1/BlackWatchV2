import assert from "node:assert/strict";
import test from "node:test";

import { summarizeAction } from "./event-summary.ts";

test("summarizes dotted actions into readable text", () => {
  assert.equal(summarizeAction("host.fim.modified"), "Host · file integrity modified");
  assert.equal(summarizeAction("iam.policy.attach"), "IAM · policy attach");
  assert.equal(summarizeAction("auth.console_login.failure"), "Auth · console login failure");
});

test("handles single segments and missing values", () => {
  assert.equal(summarizeAction("heartbeat"), "Heartbeat");
  assert.equal(summarizeAction(""), "Unknown event");
  assert.equal(summarizeAction(undefined), "Unknown event");
});
