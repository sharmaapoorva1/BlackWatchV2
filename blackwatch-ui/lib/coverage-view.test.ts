import assert from "node:assert/strict";
import test from "node:test";

import { buildCoverageCards } from "./coverage-view.ts";

const by = (s: Parameters<typeof buildCoverageCards>[0]) => Object.fromEntries(buildCoverageCards(s).map((c) => [c.id, c]));

test("a clean fleet is ok", () => {
  const c = by({ total: 4, healthy: 4, attention: 0, disabled: 0, stale: 0 });
  assert.equal(c.attention.tone, "ok");
  assert.equal(c.stale.tone, "ok");
  assert.equal(c.healthy.of, "of 4");
  assert.equal(c.healthy.ratio, 1);
});

test("attention and stale collectors escalate", () => {
  const c = by({ total: 5, healthy: 2, attention: 2, disabled: 1, stale: 1 });
  assert.equal(c.attention.tone, "high");
  assert.equal(c.stale.tone, "high");
  assert.equal(c.attention.ratio, 0.4);
  assert.equal(c.disabled.tone, "neutral");
});

test("no collectors means no ratios", () => {
  const c = by({ total: 0, healthy: 0, attention: 0, disabled: 0, stale: 0 });
  assert.equal(c.attention.of, undefined);
  assert.equal(c.attention.ratio, null);
  assert.equal(c.healthy.tone, "neutral");
});
