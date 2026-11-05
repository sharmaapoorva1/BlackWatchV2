import assert from "node:assert/strict";
import test from "node:test";

import { buildAnomalyCards, buildBaselineCards, parseUebaTab, topValue } from "./ueba-view.ts";

const rows = [
  { principal_id: "alice", dimension: "source_ip" },
  { principal_id: "alice", dimension: "source_ip" },
  { principal_id: "bob", dimension: "region" },
];

test("the tab param falls back to anomalies", () => {
  assert.equal(parseUebaTab("baselines"), "baselines");
  assert.equal(parseUebaTab("x"), "anomalies");
  assert.equal(parseUebaTab(undefined), "anomalies");
});

test("topValue picks the most common, alphabetical on ties", () => {
  assert.equal(topValue(["b", "a", "b"]), "b");
  assert.equal(topValue(["b", "a"]), "a");
  assert.equal(topValue([]), "");
});

test("anomaly cards count rows, principals and top dimension", () => {
  const by = Object.fromEntries(buildAnomalyCards(rows).map((c) => [c.id, c]));
  assert.equal(by.anomalies.value, "3");
  assert.equal(by.anomalies.tone, "high");
  assert.equal(by.principals.value, "2");
  assert.equal(by.dimension.value, "source_ip");
  const empty = Object.fromEntries(buildAnomalyCards([]).map((c) => [c.id, c]));
  assert.equal(empty.anomalies.tone, "ok");
  assert.equal(empty.dimension.value, "—");
});

test("baseline cards warn when the row limit was hit", () => {
  const by = Object.fromEntries(buildBaselineCards(rows, 3).map((c) => [c.id, c]));
  assert.match(by.baselines.detail, /Showing the first 3/);
  assert.equal(by.dimensions.value, "2");
  assert.equal(Object.fromEntries(buildBaselineCards(rows, 500).map((c) => [c.id, c])).baselines.detail, "Matching the current filter.");
});
