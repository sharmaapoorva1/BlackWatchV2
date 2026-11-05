import assert from "node:assert/strict";
import test from "node:test";

import { EVENT_FEED_LIMIT, hasFilters, resultsSummary, severityChipHref, severityMix } from "./events-view.ts";

test("severity mix counts what is shown and puts the rest under unscored", () => {
  const mix = severityMix([{ severity: "high" }, { severity: "high" }, { severity: "critical" }, { severity: null }, {}, { severity: "weird" }]);
  assert.deepEqual(mix, { critical: 1, high: 2, medium: 0, low: 0, informational: 0, unscored: 3 });
});

test("a chip applies its severity, keeps other filters, and toggles off when active", () => {
  assert.equal(severityChipHref({}, "high"), "/events?severity=high");
  assert.equal(severityChipHref({ q: "root", module: "ec2.host" }, "critical"), "/events?q=root&module=ec2.host&severity=critical");
  assert.equal(severityChipHref({ q: "root", severity: "high" }, "high"), "/events?q=root");
  assert.equal(severityChipHref({ severity: "high" }, "high"), "/events");
  // Switching severity replaces rather than adds.
  assert.equal(severityChipHref({ severity: "high" }, "low"), "/events?severity=low");
});

test("filters are detected, ignoring empty values", () => {
  assert.equal(hasFilters({}), false);
  assert.equal(hasFilters({ q: "", severity: undefined }), false);
  assert.equal(hasFilters({ module: "vpn.openvpn" }), true);
});

test("the summary is honest about the cap and about filters", () => {
  assert.equal(resultsSummary(0, false), "No events yet.");
  assert.equal(resultsSummary(0, true), "No events match these filters.");
  assert.equal(resultsSummary(1, false), "1 event, newest first.");
  assert.equal(resultsSummary(42, true), "42 events match, newest first.");
  assert.match(resultsSummary(EVENT_FEED_LIMIT, false), /^Showing the newest 200 events\. Narrow the filters/);
  assert.match(resultsSummary(EVENT_FEED_LIMIT, true), /that match\./);
});
