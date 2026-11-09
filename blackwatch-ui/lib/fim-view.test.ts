import assert from "node:assert/strict";
import test from "node:test";

import { buildFimCoverageCards, buildFimOverviewCards, humanAge } from "./fim-view.ts";
import type { FimCoverage, FimHostRow } from "./types.ts";

const host = (over: Partial<FimHostRow> = {}): FimHostRow =>
  ({ instance_id: "i", stale: false, inotify_active: true, auditd_active: true, scan_errors: 0, files_tracked: 10, ...over }) as FimHostRow;
const by = (cards: { id: string }[]) => Object.fromEntries(cards.map((c) => [c.id, c])) as Record<string, ReturnType<typeof buildFimOverviewCards>[number]>;

test("age labels", () => {
  assert.equal(humanAge(30), "30s ago");
  assert.equal(humanAge(600), "10m ago");
  assert.equal(humanAge(7200), "2h ago");
  assert.equal(humanAge(200000), "2d ago");
});

test("a healthy fleet is all ok", () => {
  const cards = buildFimOverviewCards([host(), host()], 4);
  assert.ok(cards.filter((c) => c.id !== "changes").every((c) => c.tone === "ok"));
  assert.equal(by(cards).errors.detail, "20 files tracked across all hosts.");
  assert.equal(by(cards).changes.value, "4");
});

test("stale hosts are critical, coverage gaps escalate", () => {
  const c = by(buildFimOverviewCards([host({ stale: true }), host({ inotify_active: false }), host({ auditd_active: false, scan_errors: 2 })], 0));
  assert.equal(c.stale.tone, "critical");
  assert.equal(c.stale.of, "of 3");
  assert.equal(c.realtime.tone, "high");
  assert.equal(c.whodata.tone, "medium");
  assert.equal(c.errors.value, "1");
});

test("no hosts yet", () => {
  const c = by(buildFimOverviewCards([], 0));
  assert.equal(c.stale.detail, "No hosts yet.");
  assert.equal(c.stale.ratio, null);
});

const cov = (over: Partial<FimCoverage> = {}): FimCoverage =>
  ({ paths_configured: 5, files_tracked: 1200, last_full_scan_at: "2026-11-05T10:00:00Z", last_scan_duration_ms: 1, scan_errors: 0, updated_at: null, paths_inotify: 3, paths_baseline_only: 2, inotify_active: true, inotify_watch_count: 1, auditd_active: true, configured_paths: null, ...over }) as FimCoverage;

test("coverage cards describe the agent", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  const c = by(buildFimCoverageCards(cov(), now));
  assert.equal(c.scan.value, "2h ago");
  assert.equal(c.realtime.detail, "1 watch, sub-second.");
  assert.equal(c.files.of, "in 5 paths");
  const bad = by(buildFimCoverageCards(cov({ inotify_active: false, auditd_active: false, scan_errors: 3, last_full_scan_at: null }), now));
  assert.equal(bad.realtime.tone, "high");
  assert.equal(bad.whodata.tone, "medium");
  assert.equal(bad.errors.tone, "medium");
  assert.equal(bad.scan.value, "—");
});
