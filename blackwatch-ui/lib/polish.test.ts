import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

function walk(dir: string, accept: (file: string) => boolean): string[] {
  const out: string[] = [];
  const stack = [path.join(root, dir)];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (accept(full)) out.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  }
  return out.sort();
}

test("every real page sets a document title (redirect-only pages are exempt)", () => {
  const pages = walk("app", (file) => path.basename(file) === "page.tsx");
  assert.ok(pages.length > 30, "expected to find the app's pages");
  const missing = pages.filter((page) => {
    const source = read(page);
    if (/export const metadata|export async function generateMetadata/.test(source)) return false;
    return !/\bredirect\(/.test(source);
  });
  assert.deepEqual(missing, []);
});

test("the root layout builds titles as 'Page · BlackWatch'", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /template: "%s · BlackWatch"/);
});

test("unknown URLs get a helpful not-found page with a way back", () => {
  const source = read("app/not-found.tsx");
  assert.match(source, /href="\/"/);
  assert.match(source, /href="\/events"/);
});

test("EmptyState can carry an icon and a next-step action", () => {
  const source = read("components/ui/EmptyState.tsx");
  assert.match(source, /icon\?: React\.ReactNode/);
  assert.match(source, /action\?: React\.ReactNode/);
});

test("bordered, filled panels are rounded so cards match controls and tables", () => {
  const files = [...walk("app", (f) => f.endsWith(".tsx")), ...walk("components", (f) => f.endsWith(".tsx"))];
  const panel = /(["`])([^"`\n]*?\bborder border-line(?:-soft)? bg-surface(?:-[12])?\b[^"`\n]*)\1/g;
  const offenders: string[] = [];
  for (const file of files) {
    for (const match of read(file).matchAll(panel)) {
      const classes = match[2];
      if (classes.includes("rounded")) continue;
      offenders.push(`${file}: ${classes.slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, []);
});
