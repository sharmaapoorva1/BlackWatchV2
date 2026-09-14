import test from "node:test";
import assert from "node:assert/strict";
import { appTheme } from "./theme.ts";

test("BlackWatch theme centralizes dark surfaces, responsive breakpoints, and severity colors", () => {
  assert.equal(appTheme.palette.mode, "dark");
  assert.equal(appTheme.palette.background.default, "#0A0B0F");
  assert.equal(appTheme.palette.signal.main, "#48D4E8");
  assert.equal(appTheme.palette.severity.critical, "#F43F5E");
  assert.equal(appTheme.breakpoints.values.md, 768);
  assert.equal(appTheme.typography.fontFamily, '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif');
  assert.equal(appTheme.typography.fontSize, 14);
});
