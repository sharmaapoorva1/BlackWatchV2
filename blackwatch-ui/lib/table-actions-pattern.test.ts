import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const ACTION_TABLES: Array<{ file: string; actionModule: RegExp }> = [
  { file: "components/domain/notifications/NotificationChannelsTable.tsx", actionModule: /@\/app\/notifications\/actions/ },
  { file: "components/domain/notifications/NotificationRoutesTable.tsx", actionModule: /@\/app\/notifications\/route-actions/ },
  { file: "components/domain/notifications/MetricRoutesTable.tsx", actionModule: /@\/app\/notifications\/perf-alerts\/actions/ },
];

test("tables with row actions are client files that import server actions directly", () => {
  for (const { file, actionModule } of ACTION_TABLES) {
    const source = read(file);
    assert.match(source, /^"use client";/, `${file} must be a client component`);
    assert.match(source, actionModule, `${file} must import its server actions where they are used`);
    assert.match(source, /<DataTable/, `${file} should render the shared DataTable`);
  }
});

test("the action modules those tables import are real server-action files", () => {
  for (const file of [
    "app/notifications/actions.ts",
    "app/notifications/route-actions.ts",
    "app/notifications/perf-alerts/actions.ts",
  ]) {
    assert.match(read(file), /^"use server";/, `${file} must be a "use server" module`);
  }
});

test("the notifications page no longer routes row actions through server-side wrappers", () => {
  const page = read("app/notifications/page.tsx");
  for (const name of [
    "testChannelAction",
    "toggleChannelAction",
    "deleteChannelAction",
    "toggleRouteAction",
    "silenceRouteAction",
    "deleteRouteAction",
    "testRouteAction",
    "togglePerfAlertAction",
    "deletePerfAlertAction",
  ]) {
    assert.doesNotMatch(page, new RegExp(`\\b${name}\\b`), `${name} should only be used inside the client tables`);
  }
});

test("ActionForm documents and enforces the hidden-field plus pending/confirm pattern", () => {
  const source = read("components/ui/ActionForm.tsx");
  assert.match(source, /^"use client";/);
  assert.match(source, /<form action=\{action\}/);
  assert.match(source, /type="hidden"/);
  assert.match(source, /ConfirmSubmitButton/);
  assert.match(source, /PendingButton/);
});

test("row-action columns are never hideable", () => {
  for (const { file } of ACTION_TABLES) {
    const source = read(file);
    assert.match(source, /isActions: true/, `${file} should mark its actions column`);
    assert.match(source, /enableHiding: false,\s*meta: \{ label: "Actions"/, `${file} actions column must not be hideable`);
  }
});

test("connector and rules tables follow the same pattern and never ship connector config", () => {
  for (const [file, actionModule] of [
    ["components/domain/connectors/ConnectorsTable.tsx", /@\/app\/connectors\/actions/],
    ["components/domain/MutedEventsTable.tsx", /@\/app\/rules\/actions/],
  ] as const) {
    const source = read(file);
    assert.match(source, /^"use client";/, `${file} must be a client component`);
    assert.match(source, actionModule, `${file} must import its server actions where they are used`);
    assert.match(source, /isActions: true/);
  }
  const rules = read("app/rules/RulesTable.tsx");
  assert.match(rules, /<DataTable/);
  assert.match(rules, /toggleRuleAction/);
  const connectorsPage = read("app/connectors/page.tsx");
  assert.doesNotMatch(connectorsPage, /toggleConnectorAction|deleteConnectorAction/);
  assert.match(connectorsPage, /toConnectorRow/);
});
