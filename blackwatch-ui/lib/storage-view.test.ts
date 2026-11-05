import assert from "node:assert/strict";
import test from "node:test";

import { buildBucketCards, buildDomainCards, buildStorageCards, STORAGE_DOMAINS } from "./storage-view.ts";
import type { StorageGroup, StorageSummary } from "./types.ts";

const groups = Object.fromEntries(STORAGE_DOMAINS.map((d) => [d.group, { total: 0, critical: 0, high: 0 }])) as StorageSummary["groups"];
const summary = (over: Partial<StorageSummary> = {}): StorageSummary => ({
  hours: 24,
  buckets: { total: 10, public: 0 },
  groups,
  recent_s3_security: [],
  recent_critical: [],
  ...over,
});

test("a quiet account is all ok", () => {
  const cards = buildStorageCards(summary());
  assert.ok(cards.every((c) => c.tone === "ok"));
  assert.equal(cards[0].of, "of 10 tracked");
});

test("public buckets, critical events and S3 signals escalate", () => {
  const g = { ...groups, ebs: { total: 4, critical: 2, high: 1 } as StorageSummary["groups"][StorageGroup], s3: { total: 3, critical: 1, high: 0 } };
  const by = Object.fromEntries(buildStorageCards(summary({ buckets: { total: 4, public: 1 }, groups: g, recent_s3_security: [{} as never] })).map((c) => [c.id, c]));
  assert.equal(by.public.tone, "critical");
  assert.equal(by.public.ratio, 0.25);
  assert.equal(by.critical.value, "3");
  assert.equal(by["s3-signals"].tone, "high");
});

test("domain cards follow the worst severity and link somewhere", () => {
  const g = { ...groups, ebs: { total: 4, critical: 0, high: 2 }, backup: { total: 1, critical: 1, high: 0 } };
  const by = Object.fromEntries(buildDomainCards(summary({ groups: g })).map((c) => [c.id, c]));
  assert.equal(by.ebs.tone, "high");
  assert.equal(by.ebs.detail, "2 high");
  assert.equal(by.backup.tone, "critical");
  assert.equal(by.s3.href, "/buckets");
  assert.equal(by.efs.detail, "Nothing critical or high.");
});

test("bucket cards handle an empty inventory", () => {
  const cards = buildBucketCards({ total: 0, public: 0, unencrypted: 0, no_versioning: 0 });
  assert.ok(cards.every((c) => c.ratio === null || c.ratio === 0 || c.id === "total"));
  const bad = Object.fromEntries(buildBucketCards({ total: 4, public: 1, unencrypted: 2, no_versioning: 0 }).map((c) => [c.id, c]));
  assert.equal(bad.public.tone, "critical");
  assert.equal(bad.unencrypted.tone, "medium");
  assert.equal(bad.versioning.tone, "ok");
});
