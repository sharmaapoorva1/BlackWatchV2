import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Field ties label, hint and error to the control for assistive tech", () => {
  const source = read("components/ui/Field.tsx");
  assert.match(source, /htmlFor=\{controlId\}/);
  assert.match(source, /"aria-describedby": describedBy/);
  assert.match(source, /"aria-invalid": error \? true/);
  assert.match(source, /role="alert"/);
  // A wrapper child is labelled as a group, never by pointing a label at a div.
  assert.match(source, /role="group" aria-labelledby=\{labelId\}/);
  // Required controls get a visible marker and a screen-reader word.
  assert.match(source, /\(required\)/);
});

test("FormRow and FieldStack are thin wrappers so every existing form gets the Field behaviour", () => {
  assert.match(read("components/ui/FormRow.tsx"), /<Field [^>]*layout="row"/);
  assert.match(read("components/ui/FormSection.tsx"), /<Field [^>]*layout="stack"/);
});

test("shared controls show an invalid state from aria-invalid", () => {
  for (const file of ["components/ui/Input.tsx", "components/ui/Textarea.tsx", "components/ui/NativeSelect.tsx"]) {
    assert.match(read(file), /aria-invalid:border-sev-critical/, `${file} must style aria-invalid`);
  }
});

test("form submit bars use the shared FormActions with a pending state", () => {
  const actions = read("components/ui/FormActions.tsx");
  assert.match(actions, /^"use client";/);
  assert.match(actions, /PendingButton/);
  for (const file of [
    "components/domain/notifications/ChannelForm.tsx",
    "components/domain/notifications/RuleForm.tsx",
    "components/domain/connectors/ConnectorForm.tsx",
  ]) {
    assert.match(read(file), /FormActions/, `${file} should use FormActions`);
    assert.doesNotMatch(read(file), /<Button type="submit"/, `${file} should not hand-roll a submit button`);
  }
});

test("login and password forms use Field instead of hand-rolled uppercase labels", () => {
  for (const file of ["app/login/page.tsx", "app/settings/page.tsx"]) {
    const source = read(file);
    assert.match(source, /<Field label=/, `${file} should use Field`);
    assert.doesNotMatch(source, /<label[\s\S]{0,80}uppercase/, `${file} should not hand-roll labels`);
  }
});

test("the wizard stepper is an accessible list with reachability and a stated reason", () => {
  const shell = read("components/ui/WizardShell.tsx");
  assert.match(shell, /<nav aria-label="Progress"/);
  assert.match(shell, /<ol /);
  assert.match(shell, /aria-current=\{isActive \? "step" : undefined\}/);
  assert.match(shell, /disabled=\{!reachable && !isActive\}/);
  assert.match(shell, /data-wizard-step-title/);
  assert.match(shell, /aria-describedby=\{showReason \? reasonId : undefined\}/);
  assert.match(shell, /Step \$\{/);
});

test("both wizards pass reachability and a blocked reason, and save with a pending button", () => {
  for (const file of ["app/notifications/AlertWizard.tsx", "components/domain/notifications/PerfAlertForm.tsx"]) {
    const source = read(file);
    assert.match(source, /canJump=\{/, `${file} should pass canJump`);
    assert.match(source, /blockedReason=\{/, `${file} should explain a disabled Next`);
    assert.match(source, /<PendingButton/, `${file} should save with a PendingButton`);
  }
  const alert = read("app/notifications/AlertWizard.tsx");
  assert.match(alert, /role="radiogroup" aria-labelledby="alert-step-source"/);
  assert.match(alert, /role="radiogroup" aria-labelledby="alert-step-channel"/);
});

test("list pages use the shared FilterBar with visible labels and active-filter chips", () => {
  const bar = read("components/ui/FilterBar.tsx");
  assert.match(bar, /role="search"/);
  assert.match(bar, /method="GET"/);
  for (const file of ["app/events/page.tsx", "app/audit/page.tsx", "app/notifications/log/page.tsx", "app/ueba/page.tsx"]) {
    const source = read(file);
    assert.match(source, /<FilterBar/, `${file} should use FilterBar`);
    assert.match(source, /<Field label=/, `${file} filters should have visible labels`);
    assert.match(source, /<ActiveFilters/, `${file} should show active filters`);
  }
  for (const file of ["app/tools/ip-lookup/page.tsx", "app/tools/dns-lookup/page.tsx"]) {
    assert.match(read(file), /<FilterBar/, `${file} should use FilterBar`);
  }
});
