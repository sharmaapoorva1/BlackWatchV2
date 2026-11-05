import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("long detail pages share one layout: sidebar contents + sections + collapsible blocks", () => {
  const layout = read("components/layout/DetailLayout.tsx");
  assert.match(layout, /lg:grid-cols-\[13rem_minmax\(0,1fr\)\]/);
  assert.match(layout, /lg:sticky/);
  assert.match(layout, /<SectionNav/);
});

test("the section navigator is a labelled landmark, tracks scroll, and opens collapsed blocks", () => {
  const nav = read("components/layout/SectionNav.tsx");
  assert.match(nav, /<nav aria-label=\{label\}>/);
  assert.match(nav, /IntersectionObserver/);
  assert.match(nav, /aria-current=/);
  assert.match(nav, /EXPAND_EVENT/);
  // Narrow screens get a normal disclosure, never a sticky bar that floats over content.
  assert.match(nav, /<details ref=\{disclosure\} className="[^"]*lg:hidden/);
  assert.doesNotMatch(nav, /fixed|sticky top-0 z-/);
});

test("subsections are h3 disclosure buttons that stay mounted when collapsed", () => {
  const sub = read("components/layout/Subsection.tsx");
  assert.match(sub, /<h3 id=\{`\$\{id\}-title`\}/);
  assert.match(sub, /aria-expanded=\{open\}/);
  assert.match(sub, /aria-controls=\{bodyId\}/);
  assert.match(sub, /hidden=\{!open\}/);
});

test("sections are h2 and spacing/columns are owned by Stack and AutoGrid", () => {
  const section = read("components/layout/Section.tsx");
  assert.match(section, /<h2 id=\{`\$\{id\}-title`\}/);
  assert.match(section, /repeat\(auto-fit, minmax\(min\(100%, \$\{min\}\), 1fr\)\)/);
});

test("heading scale: h1 24px, h2 18px, h3 14px", () => {
  assert.match(read("components/layout/PageHeader.tsx"), /<h1 [^>]*text-2xl/);
  assert.match(read("components/layout/Section.tsx"), /<h2 [^>]*text-lg/);
  assert.match(read("components/layout/PageSection.tsx"), /<h2 [^>]*text-lg/);
  assert.match(read("components/layout/Subsection.tsx"), /text-sm font-semibold/);
  assert.match(read("components/layout/SectionLabel.tsx"), /text-sm font-semibold/);
});

test("the host page uses the layout and no longer has a floating bar or underline jump links", () => {
  const page = read("app/hosts/[id]/page.tsx");
  assert.match(page, /<DetailLayout[\s\S]{0,40}nav=\{nav\}/);
  assert.match(page, /<Subsection/);
  assert.doesNotMatch(page, /sticky top-0 z-20/);
  assert.doesNotMatch(page, /Jump to /);
  assert.doesNotMatch(page, /text-signal hover:underline">(Current sessions|Users|Running processes)/);
  // Long inventories start collapsed.
  assert.match(page, /id: "host-processes"[^}]*defaultOpen: false/);
  assert.match(page, /id: "host-packages"[\s\S]{0,200}defaultOpen: false/);
});

test("the host page pins its identity header at the top and the contents beneath it", () => {
  const sticky = read("components/layout/StickyHeader.tsx");
  assert.match(sticky, /md:sticky md:top-0/);
  assert.match(sticky, /--sticky-header-h/);
  assert.match(sticky, /ResizeObserver/);
  // The pinned header publishes its height and cleans up on unmount.
  assert.match(sticky, /removeProperty\("--sticky-header-h"\)/);

  const layout = read("components/layout/DetailLayout.tsx");
  assert.match(layout, /lg:sticky lg:top-\[calc\(var\(--sticky-header-h,0px\)\+1rem\)\]/);

  // Anchor jumps and scroll-spy account for the header's height.
  assert.match(read("components/layout/Section.tsx"), /scroll-mt-\[calc\(var\(--sticky-header-h,0px\)\+1rem\)\]/);
  assert.match(read("components/layout/Subsection.tsx"), /scroll-mt-\[calc\(var\(--sticky-header-h,0px\)\+1rem\)\]/);
  assert.match(read("components/layout/SectionNav.tsx"), /--sticky-header-h/);

  const page = read("app/hosts/[id]/page.tsx");
  assert.match(page, /<StickyHeader>/);
  assert.match(page, /<HostHeaderBar/);
  assert.match(page, /<h1 /);
  for (const field of ["Instance", "Host", "Region", "Account", "Agent"]) {
    assert.match(page, new RegExp(`label="${field}"`));
  }
  assert.match(page, /"Address" : "Addresses"/);
  // The earlier right-hand rail is gone.
  assert.doesNotMatch(page, /HostIdentityRail/);
  assert.doesNotMatch(layout, /aside\?:/);
});

test("the Overview follows attention, health, detections, activity with h1/h2/h3 levels", () => {
  const page = read("app/page.tsx");
  const order = ['id="attention"', 'id="health"', 'id="detections"', 'id="activity"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0), "all four sections present");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "sections appear in working order");
  assert.match(page, /<PageHeader/);
  assert.match(page, /<Section /);
  assert.match(page, /SectionLabel as="h3"/);
  assert.match(page, /<StatCard/);
  assert.match(page, /<AutoGrid/);
  // The old tile strip and per-page spacing hacks are gone.
  assert.doesNotMatch(page, /function Kpi|PostureCell|mt-6 space-y/);
  // The strip no longer carries its own heading: the section supplies the h2.
  assert.doesNotMatch(read("components/domain/AttentionStrip.tsx"), /<h2/);
});

test("the Hosts list: fleet-health cards filter a slim fleet table, then activity and diagnostics", () => {
  const page = read("app/hosts/page.tsx");
  const order = ['id="health"', 'id="fleet"', 'id="activity"', 'id="diagnostics"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /searchParams/);
  assert.match(page, /parseFleetGroup\(params\.health\)/);
  // A card click changes the URL, so the table remounts with the new filters.
  assert.match(page, /key=\{`\$\{initial\.health\}\|/);
  assert.match(page, /<StatCard/);
  assert.match(page, /<Subsection[\s\S]{0,200}defaultOpen=\{false\}/);

  const table = read("components/domain/HostFleetTable.tsx");
  assert.match(table, /initial\?:/);
  assert.match(table, /from "@\/lib\/host-health"/);
  assert.match(table, /<Field label="Find a host" compact/);
  assert.doesNotMatch(table, /<h2/);
  assert.doesNotMatch(table, /Fleet health/);
});
