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
