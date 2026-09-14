import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("app shell keeps page overflow inside a shrinkable vertical content region", () => {
  const source = read("components/layout/AppShell.tsx");
  const css = read("app/globals.css");
  assert.match(source, /height: "100dvh"[\s\S]*flexDirection: "column"[\s\S]*overflow: "hidden"/);
  assert.match(source, /minHeight: 0[\s\S]*flex: 1[\s\S]*overflow: "hidden"/);
  assert.match(source, /minHeight: 0[\s\S]*flex: 1[\s\S]*overflowX: "hidden"[\s\S]*overflowY: "auto"/);
  assert.match(css, /html, body \{[\s\S]*overflow: hidden;/);
});

test("sidebar keeps its navigation background continuous through the scroll region", () => {
  const source = read("components/layout/SideNav.tsx");
  assert.match(source, /component="nav"[\s\S]*bgcolor: "background\.paper"/);
  assert.match(source, /<List[\s\S]*bgcolor: "background\.paper"/);
  assert.match(source, /MuiDrawer-paper[\s\S]*bgcolor: "background\.paper"/);
});

test("mobile card tables do not keep a desktop width or horizontal scrollbar", () => {
  const tableSource = read("components/ui/Table.tsx");
  const css = read("app/globals.css");
  assert.match(tableSource, /TableContainer/);
  assert.match(tableSource, /data-responsive={responsive \? "cards" : "scroll"}/);
  assert.match(css, /data-responsive="cards"/);
  assert.match(css, /overflow-x: hidden/);
});

test("narrow table pagination can wrap its controls", () => {
  const source = read("components/ui/Pagination.tsx");
  assert.match(source, /display: "flex"[\s\S]*width: \{ xs: "100%", sm: "auto" \}[\s\S]*flexWrap: "wrap"/);
});

test("shared form rows and notification summary rows collapse on narrow screens", () => {
  const formRow = read("components/ui/FormRow.tsx");
  const keyValue = read("components/layout/KeyValueRow.tsx");
  const channelForm = read("components/domain/notifications/ChannelForm.tsx");
  const notifications = read("app/notifications/page.tsx");
  assert.match(formRow, /gridTemplateColumns: \{ xs: "1fr", sm: "minmax\(140px,200px\) minmax\(0,1fr\)" \}/);
  assert.match(keyValue, /gridTemplateColumns: \{ xs: "1fr", sm: "minmax\(140px,1fr\) minmax\(0,2fr\)" \}/);
  assert.match(channelForm, /grid-cols-1[^\n]*sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(notifications, /grid-cols-1[^\n]*sm:grid-cols-\[minmax\(0,1fr\)_220px_80px\]/);
});

test("responsive QA matrix covers the primary routes and target widths", () => {
  const guide = read("../docs/ui-responsive-qa.md");
  for (const width of [320, 375, 768, 1024, 1280, 1440]) {
    assert.match(guide, new RegExp(`\\b${width}px\\b`));
  }
  for (const route of ["Overview", "Services", "Events", "Notifications", "Rules", "Hosts detail", "Investigations", "Tools/IP lookup"]) {
    assert.match(guide, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(guide, /document\.documentElement/);
  assert.match(guide, /scrollWidth > .*clientWidth/);
});
