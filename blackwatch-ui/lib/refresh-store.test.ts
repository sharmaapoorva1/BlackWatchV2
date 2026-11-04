import assert from "node:assert/strict";
import test from "node:test";

import { formatAge, getRefreshState, patchRefreshState, subscribeRefresh } from "./refresh-store.ts";

test("formatAge reads naturally at each scale", () => {
  assert.equal(formatAge(0), "just now");
  assert.equal(formatAge(4_000), "just now");
  assert.equal(formatAge(12_000), "12s ago");
  assert.equal(formatAge(125_000), "2m ago");
  assert.equal(formatAge(7_300_000), "2h ago");
  assert.equal(formatAge(-5_000), "just now");
});

test("store notifies only when something actually changed", () => {
  let calls = 0;
  const unsubscribe = subscribeRefresh(() => {
    calls += 1;
  });
  patchRefreshState({ active: true, intervalMs: 5000 });
  patchRefreshState({ active: true, intervalMs: 5000 });
  assert.equal(calls, 1);
  assert.equal(getRefreshState().intervalMs, 5000);
  unsubscribe();
  patchRefreshState({ active: false });
  assert.equal(calls, 1);
});
