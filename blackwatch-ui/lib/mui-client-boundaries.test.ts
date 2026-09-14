import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("the shared button wrapper keeps native and Next link boundaries safe", () => {
  const source = read("components/ui/Button.tsx");

  assert.match(source, /^"use client";/);
  assert.match(source, /import Link from "next\/link"/);
  assert.match(source, /asChild/);
  assert.match(source, /<Link/);
  assert.doesNotMatch(source, /@radix-ui\/react-slot/);
  assert.doesNotMatch(source, /@mui\/material/);
});
