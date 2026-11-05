import assert from "node:assert/strict";
import test from "node:test";

import { buildCaseCards, caseCounts, caseGroup, filterCases, parseCaseGroup, urgentActive } from "./investigations-view.ts";
import type { Investigation } from "./types.ts";

const c = (status: string, priority = "medium", updated = "2026-11-01T00:00:00Z"): Investigation =>
  ({ id: status + priority + updated, title: "t", status, priority, owner: "a", time_start: "", time_end: "", created_at: "", updated_at: updated, completed_at: null, result_count: 0, observables: [] }) as unknown as Investigation;

test("statuses fall into active, malicious or concluded", () => {
  for (const s of ["ready", "investigating", "contained", "inconclusive"]) assert.equal(caseGroup(s), "active", s);
  assert.equal(caseGroup("confirmed_malicious"), "malicious");
  for (const s of ["confirmed_expected", "false_positive", "closed"]) assert.equal(caseGroup(s), "concluded", s);
});

test("the group param is validated", () => {
  assert.equal(parseCaseGroup("active"), "active");
  assert.equal(parseCaseGroup("nope"), "");
  assert.equal(parseCaseGroup(undefined), "");
});

test("counts, urgency and ordering", () => {
  const cases = [
    c("investigating", "critical", "2026-11-03T00:00:00Z"),
    c("ready", "low", "2026-11-04T00:00:00Z"),
    c("contained", "high", "2026-11-02T00:00:00Z"),
    c("confirmed_malicious", "critical"),
    c("closed", "critical"),
  ];
  assert.deepEqual(caseCounts(cases), { active: 3, malicious: 1, concluded: 1 });
  // Only active cases count as urgent, so the closed critical case does not.
  assert.equal(urgentActive(cases), 2);
  assert.deepEqual(filterCases(cases, "active").map((x) => x.status), ["ready", "investigating", "contained"]);
  assert.equal(filterCases(cases, "").length, 5);
});

test("cards link to the filtered list and say what needs doing", () => {
  const cards = buildCaseCards([c("investigating", "high"), c("confirmed_malicious"), c("closed")]);
  const by = Object.fromEntries(cards.map((card) => [card.id, card]));
  assert.equal(by.active.tone, "high");
  assert.equal(by.active.detail, "1 high or critical priority.");
  assert.equal(by.active.href, "/investigations?group=active#cases");
  assert.equal(by.malicious.tone, "critical");
  assert.equal(by.concluded.value, "1");
  const empty = buildCaseCards([]);
  assert.equal(empty[0].tone, "ok");
  assert.equal(empty[0].of, undefined);
});
