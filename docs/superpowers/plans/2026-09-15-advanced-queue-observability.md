# Advanced Queue Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent queued connector operations from expiring before execution, expose durable live ingestion progress, and provide an Advanced Queue page for operator diagnostics.

**Architecture:** Connector workers will start their watchdog only after claiming an operation as `running`. SQS drains will report bounded progress into the existing JSONB `outcome` field, preserving append-only operation history without a destructive migration. A read-only API will expose recent operations and the UI will poll it without remounting the connector table.

**Tech Stack:** FastAPI, PostgreSQL JSONB operation outcomes, boto3 SQS, Next.js App Router, React, existing shared UI primitives.

**Spec:** User-approved troubleshooting design from the current conversation.

## Global Constraints

- Preserve the existing `bw_pgdata` volume and all operation/event history.
- Do not add destructive SQL or change queue visibility/deletion semantics.
- Keep the 120-second watchdog for active work; do not hide slow work by increasing it.
- Test operations remain bounded probes and never drain messages.
- Advanced Queue is read-only and must not mutate connector or queue data.

### Task 1: Operation admission and active timeout semantics

**Files:**
- Modify: `blackwatch/connectors/operations.py`
- Test: `tests/test_connector_operations.py`

- [ ] Add a regression test proving the watchdog is not started until an operation is marked `running`.
- [ ] Move timeout start to the worker claim point and leave queued work outside the active timeout budget.
- [ ] Keep compare-and-set timeout behavior and release slots exactly once.
- [ ] Run focused operation tests.

### Task 2: SQS progress reporting

**Files:**
- Modify: `blackwatch/connectors/aws_sqs.py`
- Modify: `blackwatch/connectors/runner.py`
- Modify: `blackwatch/connectors/operations.py`
- Test: `tests/test_connector_operations.py`

- [ ] Add a progress callback carrying connector, batch, message, stage, and counters.
- [ ] Report receive, ingest, delete, and failure milestones without exposing message bodies or secrets.
- [ ] Persist progress into the active operation JSONB outcome using compare-and-set updates.
- [ ] Preserve final safe outcome counters.
- [ ] Run focused SQS/operation tests.

### Task 3: Operations diagnostics API

**Files:**
- Modify: `blackwatch/storage.py`
- Modify: `blackwatch/api.py`
- Modify: `blackwatch-ui/lib/api.ts`
- Modify: `blackwatch-ui/lib/types.ts`
- Test: `tests/test_connector_operations.py`

- [ ] Add a bounded recent-operation reader with connector/status/kind filters.
- [ ] Expose read-only `/api/connector-operations` diagnostics with progress and safe error data.
- [ ] Add typed frontend fetch support.
- [ ] Verify the API remains bounded and does not return raw queue message bodies.

### Task 4: Advanced Queue page

**Files:**
- Create: `blackwatch-ui/app/connectors/advanced-queue/page.tsx`
- Create: `blackwatch-ui/components/domain/connectors/AdvancedQueueView.tsx`
- Modify: `blackwatch-ui/app/connectors/page.tsx`

- [ ] Add a navigation link from Connectors.
- [ ] Render queue/operation status, progress counters, stages, timestamps, correlation IDs, and recent failures.
- [ ] Poll only the diagnostics endpoint and keep layout stable during refresh.
- [ ] Use existing shared buttons, tables, status pills, and layout primitives.

### Task 5: Verification

- [ ] Run backend focused tests and the full relevant test suite where the runtime permits.
- [ ] Run frontend TypeScript and production build.
- [ ] Run `git diff --check`.
- [ ] Confirm no Compose, volume, migration, or deployment files changed.
