import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVpnCards,
  certBand,
  certDaysLeft,
  certImpact,
  certSummary,
  countByBand,
  effectiveCerts,
  formatDuration,
  renewalQueue,
  renewedNotDeployed,
  serverOk,
  sortCerts,
} from "./vpn-view.ts";
import type { VpnServer } from "./types.ts";

const NOW = Date.parse("2026-08-25T12:00:00Z");
const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

const cert = (name: string, days: number, over: Record<string, unknown> = {}) =>
  ({ kind: "server", name, source: "live", not_after: inDays(days), days_remaining: days, ...over }) as VpnServer["certs"][number];

const srv = (over: Partial<VpnServer> & { agent_stale?: boolean }): VpnServer =>
  ({ server: "vpn1", active: true, updated_at: null, age_seconds: 1, stale: false, client_count: 2, clients: [], certs: [], ...over }) as VpnServer;

test("days left come from the expiry date, not the agent's stale number", () => {
  assert.equal(Math.round(certDaysLeft({ not_after: inDays(10), days_remaining: 99 }, NOW) ?? 0), 10);
  assert.equal(certDaysLeft({ not_after: null, days_remaining: 4 }, NOW), 4);
  assert.equal(certDaysLeft({ not_after: "garbage", days_remaining: null }, NOW), null);
});

test("bands follow 7, 14 and 30 days", () => {
  assert.equal(certBand(-1), "expired");
  assert.equal(certBand(3), "critical");
  assert.equal(certBand(10), "high");
  assert.equal(certBand(20), "warning");
  assert.equal(certBand(90), "ok");
  assert.equal(certBand(null), "unknown");
  assert.equal(certBand(50, "unreadable"), "unknown");
});

test("impact says what breaks", () => {
  assert.equal(certImpact({ kind: "ca", name: "ca", revoked: false }), "Everyone is locked out");
  assert.equal(certImpact({ kind: "server", name: "s", revoked: false }), "New connections fail for everyone");
  assert.equal(certImpact({ kind: "client", name: "alice", revoked: false }), "alice can no longer connect");
  assert.equal(certImpact({ kind: "crl", name: "crl", revoked: false }), "Revocations stop being enforced");
  assert.equal(certImpact({ kind: "client", name: "bob", revoked: true }), "Already revoked");
});

test("counts are per certificate, so a PKI copy and its live copy count once", () => {
  const certs = [
    cert("a", 3, { source: "live" }),
    cert("a", 3, { source: "pki" }),
    cert("b", -2, { kind: "client" }),
    cert("c", 10, { kind: "client" }),
    cert("d", 20, { kind: "client" }),
    cert("e", 90, { kind: "client" }),
    cert("f", 5, { kind: "client", error: "unreadable" }),
  ];
  const bands = countByBand(certs, NOW);
  assert.deepEqual(bands, { expired: 1, critical: 1, high: 1, warning: 1, error: 1 });
  assert.equal(certSummary(bands), "1 expired · 1 under 7d · 1 under 14d · 1 under 30d · 1 unreadable");
  assert.equal(certSummary(countByBand([], NOW)), "");
});

test("the live copy is the one that matters, revoked certificates are ignored", () => {
  const list = effectiveCerts([cert("a", 700, { source: "pki" }), cert("a", 5, { source: "live" }), cert("gone", 1, { kind: "client", revoked: true })], NOW);
  assert.equal(list.length, 1);
  assert.equal(list[0].source, "live");
});

test("certificates sort soonest first, unreadable last", () => {
  const sorted = sortCerts([{ days_remaining: null, not_after: null }, { days_remaining: 9, not_after: inDays(9) }, { days_remaining: -2, not_after: inDays(-2) }], NOW);
  assert.deepEqual(sorted.map((c) => c.days_remaining), [-2, 9, null]);
});

test("the renewal queue lists what to renew next across servers, healthy ones omitted", () => {
  const queue = renewalQueue(
    [srv({ server: "a", certs: [cert("s1", 40), cert("s2", 6)] }), srv({ server: "b", certs: [cert("c1", 20, { kind: "client" }), cert("c2", 100, { kind: "client" })] })],
    NOW,
  );
  assert.deepEqual(queue.map((q) => `${q.server}/${q.cert.name}`), ["a/s2", "b/c1"]);
  assert.equal(queue[0].band, "critical");
  assert.equal(queue[0].impact, "New connections fail for everyone");
});

test("renewed in the PKI but not deployed is caught", () => {
  const found = renewedNotDeployed([srv({ server: "a", certs: [cert("s", 700, { source: "pki" }), cert("s", 5, { source: "live" })] })], NOW);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, "s");
  assert.ok(found[0].renewedDays > found[0].liveDays);
  assert.deepEqual(renewedNotDeployed([srv({ certs: [cert("s", 300, { source: "pki" }), cert("s", 300, { source: "live" })] })], NOW), []);
  assert.deepEqual(renewedNotDeployed([srv({ certs: [cert("s", 5, { source: "live" })] })], NOW), []);
});

test("a silent agent is not an active server", () => {
  assert.equal(serverOk({ active: true, stale: false }), true);
  assert.equal(serverOk({ active: true, stale: false, agent_stale: true }), false);
  assert.equal(serverOk({ active: true, stale: true }), false);
});

test("durations are short and readable", () => {
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(20), "<1 min");
  assert.equal(formatDuration(600), "10 min");
  assert.equal(formatDuration(7200), "2 h");
  assert.equal(formatDuration(200000), "2 d");
});

test("cards flag silent servers, expiring or undeployed certificates and failed logins", () => {
  const cards = buildVpnCards(
    [srv({}), srv({ server: "vpn2", client_count: 1, certs: [cert("s", 3)] }), srv({ server: "vpn3", agent_stale: true } as never)],
    [{ outcome: "success" }, { outcome: "failure" }],
    NOW,
  );
  const by = Object.fromEntries(cards.map((c) => [c.id, c]));
  assert.equal(by.servers.value, "2");
  assert.equal(by.servers.tone, "critical");
  assert.equal(by.clients.value, "5");
  assert.equal(by.certs.tone, "critical");
  assert.equal(by.certs.href, "#certificates");
  assert.equal(by.auth.value, "1");
  const empty = buildVpnCards([], [], NOW);
  assert.equal(empty[0].tone, "neutral");
  assert.equal(empty[3].tone, "ok");
});

test("a renewed-not-deployed certificate raises the card even when it has not expired yet", () => {
  const cards = buildVpnCards([srv({ certs: [cert("s", 300, { source: "pki" }), cert("s", 200, { source: "live" })] })], [], NOW);
  const certs = cards.find((c) => c.id === "certs")!;
  assert.equal(certs.tone, "high");
  assert.match(certs.detail, /renewed, not deployed/);
});
