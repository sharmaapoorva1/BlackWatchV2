# Material UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile bespoke UI layer with a single Material UI-based system that standardizes responsive layout and shared interaction behavior without changing server actions, API contracts, or domain logic.

**Architecture:** Add a centralized MUI theme and provider at the app root. Rebuild shared layout and control primitives around MUI, then migrate route screens incrementally while keeping domain components and data-fetching behavior stable. Remove the old Radix/Tailwind UI dependencies only after all consumers have migrated.

**Tech Stack:** Next.js 15, React 19, TypeScript, Material UI, Emotion, existing IBM Plex Sans and JetBrains Mono fonts, Recharts.

**Spec:** User-approved in conversation: complete UI makeover focused on reducing UI bugs and responsive issues; current visual identity may change.

## Global Constraints

- Do not modify database, Docker storage, migrations, deployment, or production data.
- Preserve existing server actions, API routes, route URLs, and domain/data behavior.
- Use one responsive layout system and one shared component system; do not introduce a permanent hybrid MUI/Radix UI layer.
- Verify typecheck and production build after each migration phase.

---

### Task 1: Establish MUI dependencies and root theme

**Files:**
- Modify: `blackwatch-ui/package.json`
- Modify: `blackwatch-ui/package-lock.json`
- Create: `blackwatch-ui/theme.ts`
- Create: `blackwatch-ui/components/providers/AppThemeProvider.tsx`
- Modify: `blackwatch-ui/app/layout.tsx`
- Test: `blackwatch-ui/theme.test.ts`

- [ ] Write a failing test asserting the theme exposes dark mode, responsive breakpoints, typography, and component defaults.
- [ ] Run the focused test and confirm failure because the MUI theme does not exist.
- [ ] Add `@mui/material`, `@mui/icons-material`, `@emotion/react`, and `@emotion/styled`.
- [ ] Create a dark theme with explicit palette, typography, spacing, shape, breakpoints, focus behavior, and component defaults.
- [ ] Wrap the app with `AppThemeProvider`, preserving existing font loading and metadata.
- [ ] Run the focused test and typecheck.

### Task 2: Replace the application shell and navigation

**Files:**
- Modify: `blackwatch-ui/components/layout/AppShell.tsx`
- Modify: `blackwatch-ui/components/layout/TopNav.tsx`
- Modify: `blackwatch-ui/components/layout/SideNav.tsx`
- Modify: `blackwatch-ui/components/layout/PageHeader.tsx`
- Modify: `blackwatch-ui/app/globals.css`
- Test: `blackwatch-ui/components/layout/responsive-shell.test.tsx`

- [ ] Write tests for desktop navigation, mobile drawer behavior, focus restoration, and content overflow boundaries.
- [ ] Run the focused tests and confirm the new shell behavior is absent.
- [ ] Implement the shell with MUI AppBar, Drawer, Toolbar, Box, Container, and responsive breakpoints.
- [ ] Remove global overflow hacks that cause viewport and table scrolling conflicts.
- [ ] Run focused tests and typecheck.

### Task 3: Replace shared controls and feedback primitives

**Files:**
- Modify: `blackwatch-ui/components/ui/Button.tsx`
- Modify: `blackwatch-ui/components/ui/Input.tsx`
- Modify: `blackwatch-ui/components/ui/Checkbox.tsx`
- Modify: `blackwatch-ui/components/ui/NativeSelect.tsx`
- Modify: `blackwatch-ui/components/ui/Disclosure.tsx`
- Modify: `blackwatch-ui/components/ui/FlashToast.tsx`
- Modify: `blackwatch-ui/components/ui/PendingButton.tsx`
- Modify: `blackwatch-ui/components/ui/ConfirmSubmitButton.tsx`
- Test: `blackwatch-ui/components/ui/shared-controls.test.tsx`

- [ ] Write behavior tests for disabled/loading state, keyboard focus, validation display, select behavior, disclosure state, and toast dismissal.
- [ ] Run the focused tests and confirm failures for the MUI-backed behavior.
- [ ] Implement shared controls using MUI Button, TextField, Checkbox, Select, Collapse, Snackbar, and Alert.
- [ ] Keep existing public prop contracts where practical so route migration remains mechanical.
- [ ] Run focused tests and typecheck.

### Task 4: Replace panels, cards, badges, and forms

**Files:**
- Modify: `blackwatch-ui/components/layout/DataPanel.tsx`
- Modify: `blackwatch-ui/components/ui/SelectableCard.tsx`
- Modify: `blackwatch-ui/components/ui/PickerCard.tsx`
- Modify: `blackwatch-ui/components/ui/SeverityChip.tsx`
- Modify: `blackwatch-ui/components/domain/SeverityBadge.tsx`
- Modify: `blackwatch-ui/components/ui/FormSection.tsx`
- Modify: `blackwatch-ui/components/ui/FormRow.tsx`
- Test: `blackwatch-ui/components/ui/surface-components.test.tsx`

- [ ] Write tests for consistent panel spacing, card selection, severity mapping, and narrow-screen form stacking.
- [ ] Run the focused tests and confirm failure.
- [ ] Implement surfaces with MUI Paper, Card, Stack, Grid, Chip, FormControl, and responsive layout props.
- [ ] Run focused tests and typecheck.

### Task 5: Rebuild the canonical table system

**Files:**
- Modify: `blackwatch-ui/components/ui/Table.tsx`
- Modify: `blackwatch-ui/components/ui/ResizableTable.tsx`
- Modify: `blackwatch-ui/components/ui/Pagination.tsx`
- Modify: `blackwatch-ui/components/ui/TablePreferences.tsx`
- Modify: `blackwatch-ui/app/globals.css`
- Test: `blackwatch-ui/components/ui/table-behavior.test.tsx`

- [ ] Write tests for sorting, pagination, column visibility, mobile rendering, keyboard interaction, and empty state.
- [ ] Run the focused tests and confirm failure for the MUI table implementation.
- [ ] Implement one canonical MUI Table-based component with stable overflow ownership and a mobile layout strategy.
- [ ] Preserve current table features while removing bespoke global table selectors and resize hacks that leak into unrelated layouts.
- [ ] Run focused tests and typecheck.

### Task 6: Migrate route-level screens

**Files:**
- Modify: all files under `blackwatch-ui/app/**/page.tsx` and route-local client components that import the old UI primitives.
- Test: existing route and responsive tests under `blackwatch-ui/lib/*.test.ts` plus new route smoke tests.

- [ ] Inventory remaining imports of old primitives and create a migration checklist by route group.
- [ ] Migrate dashboard, hosts, events, investigations, notifications, tools, settings, and login screens to the new shared components.
- [ ] Preserve server/client boundaries and existing action handlers.
- [ ] Add smoke coverage for representative desktop and mobile routes.
- [ ] Run full typecheck and production build.

### Task 7: Remove legacy UI dependencies and verify

**Files:**
- Modify: `blackwatch-ui/package.json`
- Modify: `blackwatch-ui/package-lock.json`
- Delete only: unused legacy UI component files after import verification.
- Modify: `blackwatch-ui/app/globals.css`
- Test: full project test/typecheck/build commands.

- [ ] Confirm no application imports remain for Radix UI, `clsx`-only legacy controls, or obsolete Tailwind UI utilities.
- [ ] Remove only dependencies and files proven unused by repository search.
- [ ] Run all available tests, typecheck, and production build.
- [ ] Inspect the final diff and Git status for unrelated changes.
