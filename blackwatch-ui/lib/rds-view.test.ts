import assert from "node:assert/strict";
import test from "node:test";

import { allowlistSummary, buildRdsCards } from "./rds-view.ts";

const base = { databases: 2, active: 5, authFailures: 0, authHours: 24, alerts: 0, alertHours: 24, sources: 9 };
const by = (input: Parameters<typeof buildRdsCards>[0] = base) => Object.fromEntries(buildRdsCards(input).map((c) => [c.id, c]));

test("quiet databases are ok, alerts and failures escalate", () => {
  const quiet = by();
  assert.equal(quiet.alerts.tone, "ok");
  assert.equal(quiet.auth.tone, "ok");
  assert.equal(quiet.sessions.of, "on 2 databases");
  const loud = by({ ...base, alerts: 3, authFailures: 12, databases: 1 });
  assert.equal(loud.alerts.tone, "high");
  assert.equal(loud.auth.tone, "critical");
  assert.equal(loud.auth.value, "12");
  assert.equal(loud.sessions.of, "on 1 database");
});

test("no databases says nothing was ingested", () => {
  assert.equal(by({ ...base, databases: 0, active: 0 }).sessions.detail, "No RDS activity ingested yet.");
});

test("allowlist summary pluralises", () => {
  assert.equal(allowlistSummary(1, 2), "1 human · 2 services");
});

test("a silent log feed raises its own card", () => {
  const quiet = by({ ...base, silent: ["prod-db"] });
  assert.equal(quiet.feed.tone, "high");
  assert.equal(quiet.feed.value, "1");
  assert.match(quiet.feed.detail, /prod-db/);
  assert.equal(by().feed.tone, "ok");
  assert.equal(by({ ...base, databases: 0 }).feed.ratio, null);
});
