import assert from "node:assert/strict";
import test from "node:test";

import { buildPostureCards, filterFindings, groupByResourceType, groupStartsOpen, parseSeverityFilter, tallySeverities } from "./posture-view.ts";

const f = (severity: string, resource_type = "s3_bucket") => ({ severity, resource_type });

test("severity param is validated and informational counts as low", () => {
  assert.equal(parseSeverityFilter("high"), "high");
  assert.equal(parseSeverityFilter("informational"), "");
  assert.equal(parseSeverityFilter(undefined), "");
  assert.deepEqual(tallySeverities([f("critical"), f("low"), f("informational"), f("weird")]), { critical: 1, high: 0, medium: 0, low: 2 });
});

test("filtering keeps one bucket", () => {
  const all = [f("high"), f("low"), f("informational")];
  assert.equal(filterFindings(all, "low").length, 2);
  assert.equal(filterFindings(all, "").length, 3);
});

test("resource types sort hottest first", () => {
  const groups = groupByResourceType([f("low", "a"), f("high", "b"), f("critical", "b"), f("low", "c"), f("low", "c")]);
  assert.deepEqual(groups.map(([name]) => name), ["b", "c", "a"]);
});

test("groups with hot findings or few groups start open", () => {
  assert.equal(groupStartsOpen([f("high")], 10), true);
  assert.equal(groupStartsOpen([f("low")], 10), false);
  assert.equal(groupStartsOpen([f("low")], 3), true);
});

test("cards filter the list and go ok when empty", () => {
  const cards = buildPostureCards([f("critical"), f("low")]);
  const by = Object.fromEntries(cards.map((c) => [c.id, c]));
  assert.equal(by.critical.tone, "critical");
  assert.equal(by.critical.href, "/aws-posture?severity=critical#findings");
  assert.equal(by.high.tone, "ok");
  assert.equal(by.low.tone, "neutral");
  assert.equal(by.critical.of, "of 2");
  assert.equal(buildPostureCards([])[0].of, undefined);
});
