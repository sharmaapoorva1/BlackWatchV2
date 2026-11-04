import assert from "node:assert/strict";
import test from "node:test";

import { activeParams, hrefWithout } from "./filters.ts";

test("hrefWithout drops one filter and keeps the rest", () => {
  const params = { q: "root", severity: "high", module: "" };
  assert.equal(hrefWithout("/events", params, "severity"), "/events?q=root");
  assert.equal(hrefWithout("/events", params, "q"), "/events?severity=high");
});

test("hrefWithout returns the bare path when nothing is left", () => {
  assert.equal(hrefWithout("/events", { q: "x" }, "q"), "/events");
  assert.equal(hrefWithout("/events", {}), "/events");
});

test("values are URL-encoded", () => {
  assert.equal(hrefWithout("/events", { q: "a b&c" }), "/events?q=a+b%26c");
});

test("activeParams ignores empty and undefined values", () => {
  assert.deepEqual(activeParams({ a: "1", b: "", c: undefined }), [["a", "1"]]);
});
