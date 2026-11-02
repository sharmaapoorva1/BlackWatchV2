# Host Detail Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the host detail page into a triage-first one-page view with direct navigation to all host evidence.

**Architecture:** Reorganize the existing server page around overview and evidence sections. Reuse existing host data, tables, status summaries, and metric chart; add only semantic anchor navigation and clearer section structure.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing BlackWatch UI components.

**Spec:** `docs/superpowers/specs/2026-11-02-host-detail-triage-design.md`

## Global Constraints

- Do not change agent collection, API contracts, projections, or database schema.
- Preserve all current telemetry, package rows, searchable inventories, and pagination.
- Preserve `bw_pgdata`; do not run destructive database or Compose volume commands.
- Use the established dark BlackWatch design and severity semantics.

## Review Focus

- Empty or absent timestamps render a placeholder and never crash a table.
- A host with no recent alerts still clearly shows its health and empty activity state.
- Stale/failed collectors and active delivery errors remain visible without expanding a generic category accordion.
- Long paths, hashes, host names, and inventory values remain readable on narrow widths.
- Mixed evidence types are not combined into misleading counts.

---

### Task 1: Rebuild host page information hierarchy

**Files:**
- Modify: `blackwatch-ui/app/hosts/[id]/page.tsx`
- Modify only if necessary: `blackwatch-ui/components/domain/HostInventoryTable.tsx`
- Modify only if necessary: `blackwatch-ui/components/domain/HostMetricsChart.tsx`

**Interfaces:**
- Consume the existing `HostDetailResponse` and host telemetry types unchanged.
- Preserve current component APIs unless a concrete page issue requires a minimal extension.

- [x] Replace generic category accordions with the approved overview, anchor navigation, and always-visible evidence sections.
- [x] Separate high/critical findings from the newest activity feed and keep both within the overview.
- [x] Keep status concise; move delivery/debug fields to the explicit Agent & delivery section.
- [x] Give evidence counts only to their specific collections and keep all inventory rows searchable/paginated.
- [x] Keep responsive order and anchor offsets correct for the sticky global header and local section navigation.

### Task 2: Verify the shipped UI path

**Files:**
- No additional files expected.

- [x] Run the TypeScript check from `blackwatch-ui`.
- [x] Run the production Next.js build from `blackwatch-ui`.
- [x] Run `git diff --check` and inspect the final diff for lost telemetry sections or accidental backend/storage changes.
