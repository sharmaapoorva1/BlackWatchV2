import assert from "node:assert/strict";
import test from "node:test";

import { buildRuleCards, isBroadMute, ruleCounts } from "./rules-view.ts";

const r = (over: Record<string, unknown> = {}) => ({ enabled: true, rule_action: "alert", severity: "medium", ...over }) as Parameters<typeof ruleCounts>[0][number];
const m = (over: Record<string, unknown> = {}) => ({ source_type: null, username: null, reason: null, ...over }) as Parameters<typeof isBroadMute>[0];

test("counts enabled, disabled, suppress and serious rules", () => {
  const c = ruleCounts([r(), r({ severity: "critical" }), r({ enabled: false, severity: "high" }), r({ rule_action: "suppress", severity: "high" })]);
  assert.deepEqual(c, { total: 4, enabled: 3, disabled: 1, suppress: 1, serious: 1 });
});

test("a mute with no filters is broad", () => {
  assert.equal(isBroadMute(m()), true);
  assert.equal(isBroadMute(m({ username: "app" })), false);
});

test("cards flag no rules, disabled rules and broad mutes", () => {
  const by = Object.fromEntries(buildRuleCards([], []).map((c) => [c.id, c]));
  assert.equal(by.enabled.tone, "high");
  assert.equal(by.enabled.ratio, null);
  const cards = Object.fromEntries(buildRuleCards([r(), r({ enabled: false })], [m(), m({ reason: "x" })]).map((c) => [c.id, c]));
  assert.equal(cards.disabled.tone, "medium");
  assert.equal(cards.muted.tone, "medium");
  assert.equal(cards.muted.detail, "1 mutes a whole action. Events are dropped before storage.");
  assert.equal(cards.enabled.of, "of 2");
});
