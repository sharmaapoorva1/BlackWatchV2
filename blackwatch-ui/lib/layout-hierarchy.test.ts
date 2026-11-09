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
  assert.match(sticky, /md:sticky md:top-\[calc\(var\(--main-pad-top,0px\)\*-1\)\]/);
  assert.match(sticky, /md:-mt-\[var\(--main-pad-top,0px\)\]/);
  assert.match(sticky, /--sticky-header-h/);
  assert.match(sticky, /ResizeObserver/);
  // The pinned header publishes its height and cleans up on unmount.
  assert.match(sticky, /removeProperty\("--sticky-header-h"\)/);

  const layout = read("components/layout/DetailLayout.tsx");
  assert.match(layout, /lg:sticky lg:top-\[max\(0px,calc\(var\(--sticky-header-h,0px\)\+1rem-var\(--main-pad-top,0px\)\)\)\]/);

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

test("the Events page: one h2 feed with chips, filters, mix and table, and a pinned-header padding fix", () => {
  const page = read("app/events/page.tsx");
  assert.match(page, /<Section\s+id="feed"/);
  for (const part of ["<SeverityChips", "<EventFilters", "<ActiveFilters", "<SavedFilters", "<SeverityMixBar", "<EventsDataTable"]) {
    assert.ok(page.includes(part), `${part} should be on the page`);
  }
  assert.match(page, /limit: EVENT_FEED_LIMIT/);
  // The severity select moved to chips; the form must still carry the chosen severity.
  assert.match(page, /type="hidden" name="severity"/);
  assert.match(page, /action=\{\s*filtered \?/);

  // The scroll area's top padding is cancelled inside the pinned header (no strip above it).
  assert.match(read("components/layout/AppShell.tsx"), /\[--main-pad-top:1rem\][^"]*md:\[--main-pad-top:1\.25rem\]/);
});

test("the Services page: health cards, attention list, VPC blocks, agents, archive; status filter from the URL", () => {
  const page = read("app/services/page.tsx");
  const order = ['id="health"', 'id="attention"', 'id="services"', 'id="agents"', 'id="archive"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /parseStatusFilter\(params\.status\)/);
  assert.match(page, /filterGrouped\(grouped, status\)/);
  assert.match(page, /<StatCard/);
  // One collapsible block per VPC; problem VPCs open, healthy ones fold when there are many.
  assert.match(page, /<Subsection[\s\S]{0,200}defaultOpen=\{vpcStartsOpen/);
  // The archive stays collapsed.
  assert.match(page, /id="services-archive"[\s\S]{0,300}defaultOpen=\{false\}/);
  // No page-local heading markup or margin hacks.
  assert.doesNotMatch(page, /SectionLabel|mt-6 space-y|<details/);
});

test("Investigations: list has start, status cards and filterable cases; detail has a pinned header and sidebar sections", () => {
  const list = read("app/investigations/page.tsx");
  const order = ['id="start"', 'id="summary"', 'id="cases"'].map((needle) => list.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(list, /parseCaseGroup\(/);
  assert.match(list, /filterCases\(/);
  assert.match(list, /<StatCard/);
  assert.doesNotMatch(list, /SectionLabel/);

  const notebook = read("app/investigations/InvestigationNotebook.tsx");
  assert.match(notebook, /<StickyHeader>/);
  assert.match(notebook, /<DetailLayout nav=\{nav\}>/);
  for (const id of ["summary", "intelligence", "evidence", "next-steps", "notes"]) {
    assert.ok(notebook.includes(`<Section id="${id}"`), `section ${id}`);
  }
  for (const id of ["evidence-chain", "evidence-pulse", "evidence-detail"]) {
    assert.ok(notebook.includes(`<Subsection id="${id}"`), `subsection ${id}`);
  }
  // Reviewing evidence opens the collapsed block before scrolling to it.
  assert.match(notebook, /EXPAND_EVENT[\s\S]{0,120}evidence-detail/);
  assert.doesNotMatch(notebook, /SectionLabel|<h2/);
  assert.doesNotMatch(read("app/investigations/InvestigationIpIntelligence.tsx"), /SectionLabel/);
});

test("the VPN page: health cards, collapsible servers, auth attempts", () => {
  const page = read("app/vpn/page.tsx");
  const order = ['id="health"', 'id="servers" title="Servers" description', 'id="auth"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /<StatCard/);
  assert.match(page, /<Subsection[\s\S]{0,300}defaultOpen=\{/);
  assert.doesNotMatch(page, /<SectionLabel>\{/);
});

test("the API Gateway page: health cards, then alerts, failures, APIs, sources", () => {
  const page = read("app/api-gw/page.tsx");
  const order = ['id="health"', 'id="alerts"', 'id="failures"', 'id="apis"', 'id="sources"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /<StatCard/);
  assert.doesNotMatch(page, /SectionLabel|mt-6 space-y/);
});

test("the RDS page: health cards, alerts, auth failures, sessions, sources, databases, allowlist", () => {
  const page = read("app/rds/page.tsx");
  const order = ['id="health"', 'id="alerts"', 'id="auth"', 'id="connected"', 'id="sources"', 'id="databases"', 'id="allowlist"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /<StatCard/);
  assert.match(page, /id="sessions-history"[\s\S]{0,200}defaultOpen=\{false\}/);
  assert.doesNotMatch(page, /SectionLabel|<details|mt-6 space-y/);
});

test("the IAM page: attention cards, then access, network and audit sections of collapsible streams", () => {
  const page = read("app/iam/page.tsx");
  const order = ['id="health"', 'id="access"', 'id="network"', 'id="audit"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /<StatCard/);
  assert.match(page, /defaultOpen=\{events\.length > 0\}/);
  assert.doesNotMatch(page, /SectionLabel|CountersStrip|mt-6 space-y/);
});

test("Storage and S3 buckets: health cards then sections, no hand-rolled counters", () => {
  const page = read("app/storage/page.tsx");
  const order = ['id="health"', 'id="domains"', 'id="s3-security"', 'id="critical"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.doesNotMatch(page, /SectionLabel|mt-6 space-y/);
  const buckets = read("app/buckets/page.tsx");
  assert.match(buckets, /buildBucketCards\(counts\)/);
  assert.match(buckets, /<Section id="buckets"/);
  assert.doesNotMatch(buckets, /CountCell|PageSection/);
});

test("the UEBA page: summary cards, then the anomalies or baselines section for the chosen tab", () => {
  const page = read("app/ueba/page.tsx");
  assert.match(page, /<Section id="summary"/);
  assert.match(page, /<Section id="anomalies"/);
  assert.match(page, /<Section id="baselines"/);
  assert.match(page, /parseUebaTab\(params\.tab\)/);
  assert.doesNotMatch(page, /SectionLabel|mb-4 space-y/);
});

test("AWS posture: severity cards filter the findings, one collapsible block per resource type; detail page has summary and evidence", () => {
  const page = read("app/aws-posture/page.tsx");
  assert.ok(page.indexOf('id="health"') > 0 && page.indexOf('id="health"') < page.indexOf('id="findings"'));
  assert.match(page, /parseSeverityFilter\(params\.severity\)/);
  assert.match(page, /filterFindings\(findings, severity\)/);
  assert.match(page, /<Subsection[\s\S]{0,300}defaultOpen=\{groupStartsOpen/);
  assert.doesNotMatch(page, /SectionLabel|SeverityCounterGrid|mt-6 space-y/);
  const detail = read("app/aws-posture/[id]/page.tsx");
  assert.match(detail, /<Section id="summary"/);
  assert.match(detail, /<Section id="evidence"/);
  assert.doesNotMatch(detail, /SectionLabel/);
});

test("FIM: coverage cards, hosts, activity; per-host page leads with coverage and collapses configuration", () => {
  const page = read("app/fim/page.tsx");
  const order = ['id="health"', 'id="hosts"', 'id="activity"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.doesNotMatch(page, /PageSection|SectionLabel/);
  const host = read("app/fim/[id]/page.tsx");
  const hostOrder = ['id="coverage"', 'id="changes"', 'id="paths"', 'id="configuration"'].map((needle) => host.indexOf(needle));
  assert.ok(hostOrder.every((index) => index > 0));
  assert.deepEqual([...hostOrder].sort((a, b) => a - b), hostOrder);
  assert.match(host, /id="configuration-howto"[^>]*defaultOpen=\{false\}/);
  assert.doesNotMatch(host, /SectionLabel|mt-6 space-y/);
});

test("Notifications: delivery-health cards, then channels, routes, metrics, coverage, activity; log and studio use the same sections", () => {
  const page = read("app/notifications/page.tsx");
  const order = ['id="health"', 'id="channels"', 'id="routes"', 'id="metrics"', 'id="coverage"', 'id="activity"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /buildNotificationCards\(/);
  assert.doesNotMatch(page, /SectionHeader|CollapsibleSection|AcksBanner/);
  assert.match(read("app/notifications/log/page.tsx"), /<Section id="entries"/);
  const studio = read("app/notifications/profiles/page.tsx");
  assert.match(studio, /<Section\s+id="modules"/);
  assert.match(studio, /<Subsection/);
});

test("Connectors: health cards filter the list; edit and queue pages use sections", () => {
  const page = read("app/connectors/page.tsx");
  assert.ok(page.indexOf('id="health"') > 0 && page.indexOf('id="health"') < page.indexOf('id="connectors"'));
  assert.match(page, /parseConnectorGroup\(health\)/);
  assert.match(page, /filterConnectors\(/);
  assert.match(page, /<StatCard/);
  assert.match(read("app/connectors/[id]/page.tsx"), /<Section id="settings"/);
  assert.match(read("app/connectors/advanced-queue/page.tsx"), /<Section id="operations"/);
});

test("Rules: health cards, catalog, muted filters with a collapsible mute form", () => {
  const page = read("app/rules/page.tsx");
  const order = ['id="health"', 'id="catalog"', 'id="muted"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /buildRuleCards\(rules, muted\)/);
  assert.match(page, /<Field label="Action"/);
  assert.doesNotMatch(page, /<section|MessageBar|tracking-\[/);
});

test("Settings: preferences, account, reference; notes collapsed", () => {
  const page = read("app/settings/page.tsx");
  const order = ['id="preferences"', 'id="account"', 'id="reference"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /id="operator-notes"[^>]*defaultOpen=\{false\}/);
  assert.doesNotMatch(page, /SectionLabel|mt-6 space-y/);
});

test("Event detail: summary, optional intel, payload with collapsible envelope and raw record", () => {
  const page = read("app/events/[id]/page.tsx");
  const order = ['id="summary"', 'id="intel"', 'id="payload"'].map((needle) => page.indexOf(needle));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(page, /id="payload-raw"[^>]*defaultOpen=\{false\}/);
  assert.doesNotMatch(page, /SectionLabel|mt-6 space-y/);
});

test("Tools: index and lookups use sections and breadcrumbs, not back links", () => {
  assert.match(read("app/tools/page.tsx"), /<Section\s+id="lookups"/);
  for (const file of ["app/tools/ip-lookup/page.tsx", "app/tools/dns-lookup/page.tsx"]) {
    const page = read(file);
    assert.match(page, /<Section id="lookup"/, file);
    assert.match(page, /<Section id="result"/, file);
    assert.match(page, /breadcrumbs=\{\[\{ label: "Tools"/, file);
    assert.doesNotMatch(page, /back to tools/, file);
  }
});

test("Coverage and Audit: health cards over the collectors table; audit entries in a section", () => {
  const coverage = read("app/coverage/page.tsx");
  assert.ok(coverage.indexOf('id="health"') > 0 && coverage.indexOf('id="health"') < coverage.indexOf('id="collectors"'));
  assert.match(coverage, /buildCoverageCards\(data\.summary\)/);
  assert.doesNotMatch(coverage, /function Metric/);
  assert.match(read("app/audit/page.tsx"), /<Section id="entries"/);
});

test("Notification forms: breadcrumbs and a section instead of back links and bare panels", () => {
  for (const file of [
    "app/notifications/channels/new/page.tsx",
    "app/notifications/channels/[id]/page.tsx",
    "app/notifications/create/page.tsx",
    "app/notifications/rules/new/page.tsx",
    "app/notifications/rules/[id]/edit/page.tsx",
  ]) {
    const page = read(file);
    assert.match(page, /<Section/, file);
    assert.match(page, /breadcrumbs=\{\[\{ label: "Notifications"/, file);
    assert.doesNotMatch(page, /BackLink|back to notifications/, file);
  }
});

test("Connector add form, notification log and profile editor use breadcrumbs and sections", () => {
  const add = read("app/connectors/new/page.tsx");
  assert.match(add, /<Section id="settings"/);
  assert.match(add, /<Section id="type"/);
  assert.doesNotMatch(add, /back to connectors/);
  assert.doesNotMatch(read("app/notifications/log/page.tsx"), /BackLink/);
  const editor = read("app/notifications/profiles/[id]/page.tsx");
  for (const id of ["delivery", "message", "advanced", "test"]) assert.ok(editor.includes(`id="${id}"`), id);
  assert.match(editor, /<PageHeader/);
  assert.doesNotMatch(editor, /BackLink|SectionTitle/);
});
