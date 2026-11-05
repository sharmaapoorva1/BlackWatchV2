import assert from "node:assert/strict";
import test from "node:test";

import { buildVpnCards, certSummary, countByBand, sortCerts } from "./vpn-view.ts";
import type { VpnServer } from "./types.ts";

const srv = (over: Partial<VpnServer>): VpnServer =>
  ({ server: "vpn1", active: true, updated_at: null, age_seconds: 1, stale: false, client_count: 2, clients: [], certs: [], ...over }) as VpnServer;

test("certs are banded by days remaining", () => {
  const b = countByBand([{ days_remaining: -1 }, { days_remaining: 3 }, { days_remaining: 10 }, { days_remaining: 20 }, { days_remaining: 90 }, { error: "bad" }, { days_remaining: null }]);
  assert.deepEqual(b, { expired: 1, critical: 1, high: 1, warning: 1, error: 1 });
  assert.equal(certSummary(b), "1 expired · 1 under 7d · 1 under 14d · 1 under 30d · 1 unreadable");
  assert.equal(certSummary(countByBand([])), "");
});

test("certs sort soonest first, unknown last", () => {
  assert.deepEqual(sortCerts([{ days_remaining: null }, { days_remaining: 9 }, { days_remaining: -2 }]).map((c) => c.days_remaining), [-2, 9, null]);
});

test("cards flag down servers, expiring certs and failed logins", () => {
  const cards = buildVpnCards(
    [srv({}), srv({ server: "vpn2", stale: true, client_count: 1, certs: [{ kind: "server", name: "s", days_remaining: 3 }] })],
    [{ outcome: "success" }, { outcome: "failure" }],
  );
  const by = Object.fromEntries(cards.map((c) => [c.id, c]));
  assert.equal(by.servers.value, "1");
  assert.equal(by.servers.tone, "critical");
  assert.equal(by.clients.value, "3");
  assert.equal(by.certs.tone, "critical");
  assert.equal(by.auth.value, "1");
  const empty = buildVpnCards([], []);
  assert.equal(empty[0].tone, "neutral");
  assert.equal(empty[3].tone, "ok");
});
