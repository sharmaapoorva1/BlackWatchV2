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
  assert.match(source, /h-dvh[\s\S]*flex-col[\s\S]*overflow-hidden/);
  assert.match(source, /min-h-0[\s\S]*flex-1[\s\S]*overflow-hidden/);
  assert.match(source, /min-h-0[\s\S]*flex-1[\s\S]*overflow-x-hidden[\s\S]*overflow-y-auto/);
  assert.match(css, /html, body \{[\s\S]*overflow: hidden;/);
});

test("sidebar keeps its navigation background continuous through the scroll region", () => {
  const source = read("components/layout/SideNav.tsx");
  assert.match(source, /<nav[\s\S]*bg-canvas/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /matchMedia\("\(min-width: 768px\)"\)/);
  assert.match(source, /Close navigation/);
  assert.doesNotMatch(source, /MuiDrawer|@mui/);
});

test("shared controls provide mobile touch targets and consistent focus feedback", () => {
  const button = read("components/ui/Button.tsx");
  const input = read("components/ui/Input.tsx");
  const select = read("components/ui/NativeSelect.tsx");
  assert.match(button, /min-h-11[\s\S]*sm:min-h-8/);
  assert.match(button, /focus-visible:ring-2/);
  assert.match(input, /min-h-11[\s\S]*sm:min-h-8/);
  assert.match(select, /min-h-11[\s\S]*sm:min-h-8/);
});

test("mobile card tables do not keep a desktop width or horizontal scrollbar", () => {
  const tableSource = read("components/ui/DataTable.tsx");
  const connectors = read("app/connectors/page.tsx");
  const css = read("app/globals.css");
  assert.match(css, /\.bw-table-shell[\s\S]*overflow-x: auto/);
  assert.match(tableSource, /data-responsive={responsive \? "cards" : "scroll"}/);
  assert.doesNotMatch(tableSource, /min-w-\[72rem\]/);
  assert.match(tableSource, /bw-table-shell-cards/);
  assert.doesNotMatch(connectors, /DataPanel className="overflow-hidden"/);
  assert.match(css, /data-responsive="cards"/);
  assert.match(css, /overflow-x: hidden/);
});

test("connector actions do not pass server actions through a client auth boundary", () => {
  const source = read("app/connectors/page.tsx");
  assert.doesNotMatch(source, /<RequireAdmin>/);
  assert.doesNotMatch(source, /import \{ RequireAdmin \}/);
});

test("the shared DataTable renders native semantic table elements", () => {
  const source = read("components/ui/DataTable.tsx");
  assert.match(source, /<thead/);
  assert.match(source, /<tbody/);
  assert.match(source, /<tr/);
  assert.match(source, /<th/);
  assert.match(source, /<td/);
  assert.match(source, /scope="col"/);
  assert.match(source, /aria-sort/);
  assert.match(source, /flexRender/);
  assert.doesNotMatch(source, /@mui/);
});

test("no page still uses the retired JSX-children Table", () => {
  const stack = [path.join(root, "app"), path.join(root, "components")];
  const offenders: string[] = [];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.tsx?$/.test(entry.name) && /from "@\/components\/ui\/Table"/.test(fs.readFileSync(full, "utf8"))) {
        offenders.push(path.relative(root, full));
      }
    }
  }
  assert.deepEqual(offenders, []);
  assert.equal(fs.existsSync(path.join(root, "components/ui/Table.tsx")), false);
});

test("tables switch to cards before the sidebar leaves too little content width", () => {
  const css = read("app/globals.css");
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /bw-table-shell-cards[\s\S]*overflow-x: hidden/);
});

test("narrow table pagination can wrap its controls", () => {
  const source = read("components/ui/Pagination.tsx");
  assert.match(source, /flex flex-wrap/);
  assert.match(source, /w-full flex-wrap[\s\S]*sm:w-auto/);
});

test("shared form rows and notification summary rows collapse on narrow screens", () => {
  const formRow = read("components/ui/Field.tsx");
  const keyValue = read("components/layout/KeyValueRow.tsx");
  const channelForm = read("components/domain/notifications/ChannelForm.tsx");
  const notifications = read("app/notifications/page.tsx");
  assert.match(formRow, /grid-cols-1[\s\S]*sm:grid-cols-\[minmax\(140px,200px\)_minmax\(0,1fr\)\]/);
  assert.match(keyValue, /grid-cols-1[\s\S]*sm:grid-cols-\[minmax\(140px,1fr\)_minmax\(0,2fr\)\]/);
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
