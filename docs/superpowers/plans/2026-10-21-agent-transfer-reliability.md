# BlackWatch Agent Transfer Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BlackWatch agent delivery fast, measurable, and accurate without confusing delayed ingestion with a stopped agent.

**Architecture:** Keep the existing SQS path as a compatibility path while introducing a BlackWatch-owned direct HTTPS transport. Agents will send critical events immediately and bulk telemetry in bounded batches. BlackWatch will acknowledge data after durable ingress persistence, then process it asynchronously into PostgreSQL. Agent health will be derived from separate collection, delivery, acceptance, and processing timestamps.

**Tech Stack:** Existing Python agent, FastAPI, PostgreSQL additive migrations, systemd, persistent filesystem spool, direct HTTPS with per-agent authentication, existing React/Next.js UI.

**Spec:** Current architecture evidence in `docs/ec2-agent.md`, `blackwatch/hosts/staleness.py`, `blackwatch/modules/ec2_host.py`, `blackwatch/pipeline.py`, and the agreed three-phase requirements from this conversation.

## Global Constraints

- Preserve the existing `bw_pgdata` volume and never use `docker compose down -v`.
- All database changes must be additive and data-preserving.
- Do not remove SQS until the direct path has passed the canary and acceptance gates.
- Do not send agents directly to PostgreSQL.
- Do not return a successful transport acknowledgment until the payload is durably persisted.
- Use at-least-once delivery with idempotent event handling; do not claim end-to-end exactly-once delivery.
- Do not add arbitrary remote shell execution or general-purpose remote command capability.
- Preserve existing user changes and keep deployment changes separate from application changes.

## Review Focus

- A healthy agent whose report is delayed in transport or ingestion must not be labeled stopped; test each phase timestamp independently.
- Retransmitted reports must not duplicate events or notifications; test stable event IDs and duplicate acknowledgments.
- Agent reboot must reset sequence state safely using a new boot ID; test sequence gaps and restarts.
- A full or unavailable server spool must produce explicit backpressure and preserve critical local events; test `429`/`503`, retry, and priority behavior.
- Malformed or oversized payloads must be quarantined with a visible reason and must not block other agents; test validation and isolation.

---

## Phase 1: Make freshness and transfer state truthful

**Outcome:** Before changing transport, BlackWatch can tell whether a problem is on the agent, network path, ingress, or database processing path.

### Task 1: Add transfer metadata to agent reports

**Files:**
- Modify: `scripts/ec2_agent.py`
- Modify: `scripts/vpn_agent.py` using the same envelope contract where applicable
- Modify: `blackwatch/modules/ec2_host.py`
- Modify: `blackwatch/modules/base.py` or the shared adapter contract if needed
- Test: `tests/test_ec2_host.py` and transport-envelope tests

**Interfaces:**
- Agent report fields: `agent_id`, `boot_id`, `sequence`, `collected_at`, `sent_at`, `report_id`, and `priority_counts`.
- Adapter output preserves source timestamps and transport metadata in event extras without replacing them with server time.

- [ ] Write failing tests proving report metadata survives adapter parsing and that heartbeat event time is based on the agent collection timestamp when present.
- [ ] Run the focused tests and confirm they fail for the missing metadata.
- [ ] Add a boot-stable sequence counter and report timestamps without changing the existing report payload meaning.
- [ ] Preserve journal/FIM deterministic IDs and add transport metadata around them rather than replacing them.
- [ ] Run the focused agent and adapter tests and confirm they pass.

### Task 2: Separate accepted, processed, and observed health

**Files:**
- Create: additive migration for an agent delivery status read model
- Modify: `blackwatch/storage.py`
- Modify: `blackwatch/hosts/staleness.py`
- Modify: `blackwatch/hosts/projection.py`
- Modify: `blackwatch/connectors/aws_sqs.py` to record acceptance and processing timestamps
- Test: `tests/test_host_staleness.py`, connector progress tests, and storage tests

**Interfaces:**
- Delivery status fields: `agent_id`, `last_observed_at`, `last_sent_at`, `last_accepted_at`, `last_processed_at`, `last_sequence`, `boot_id`, `queue_delay_seconds`, `processing_delay_seconds`, and `last_error`.
- Health classification: `healthy`, `delivery_delayed`, `processing_delayed`, `collector_degraded`, `silent`, and `data_loss_risk`.

- [ ] Write failing tests showing that a recently accepted report with slow processing is `processing_delayed`, not `silent`.
- [ ] Write a regression test showing that a healthy agent is not marked stopped merely because the database projection is behind.
- [ ] Add the migration and storage functions using additive SQL only.
- [ ] Update SQS ingestion to record the transport boundary separately from projection completion.
- [ ] Change staleness notifications to say exactly which boundary is delayed.
- [ ] Run focused tests and the existing connector/host test suites.

### Task 3: Expose delivery diagnostics to the UI

**Files:**
- Modify: existing agent/host API routes in `blackwatch/api.py`
- Modify: existing host and advanced queue UI data hooks/pages
- Test: API tests and UI data-state tests

**Interfaces:**
- Read-only response containing per-agent phase timestamps, current health state, queue age, sequence gaps, last error, and agent version.

- [ ] Write failing API tests for the new phase-aware status response.
- [ ] Add the read model/API without changing existing host/event response contracts.
- [ ] Display “agent healthy,” “delivery delayed,” and “processing delayed” distinctly.
- [ ] Add last accepted, last processed, and processing lag to the operator view.
- [ ] Verify no existing page treats `stale` as synonymous with service failure.

**Phase 1 gate:** Do not begin direct transport until the UI can distinguish agent silence from delivery and processing delay, and the regression test reproduces the previously observed false-stale case.

---

## Phase 2: Add BlackWatch-owned direct transfer

**Outcome:** A direct, low-latency transport exists beside SQS, with durable admission and independent ingestion.

### Task 4: Introduce a transport abstraction and priority queues

**Files:**
- Create: `scripts/agent_transport.py`
- Modify: `scripts/ec2_agent.py`
- Modify: `scripts/vpn_agent.py` if the same transport is adopted there
- Test: `tests/test_agent_transport.py`

**Interfaces:**
- `Transport.send(batch: bytes, *, priority: str) -> SendResult`
- `SendResult`: `accepted`, `ack_id`, `accepted_at`, `retry_after`, and `error_category`.
- Configuration: `BLACKWATCH_TRANSPORT=sqs|https`, `BLACKWATCH_INGEST_URL`, and per-agent credentials/certificates.

- [ ] Write failing tests for critical-vs-bulk ordering, bounded micro-batching, retry-after handling, and local spool recovery.
- [ ] Add separate critical and bulk queues with critical events sent first.
- [ ] Keep the existing SQS implementation behind the abstraction for rollback.
- [ ] Add direct HTTPS support with connection reuse, bounded request size, compression for bulk batches, and strict timeouts.
- [ ] Ensure local spool files are written atomically with private permissions.
- [ ] Run transport tests under success, timeout, connection refusal, and server-backpressure conditions.

### Task 5: Add durable direct ingress

**Files:**
- Create: `blackwatch/agents/ingress.py`
- Create: `blackwatch/agents/spool.py`
- Create: `blackwatch/services/agent_ingest_worker.py`
- Modify: `blackwatch/api.py`
- Modify: `docker-compose.yml` with a new ingress spool volume only; do not modify or recreate `bw_pgdata`
- Test: ingress, spool, worker, and backpressure tests

**Interfaces:**
- `POST /api/agent/v1/reports`
- Response `202` only after atomic durable persistence.
- Response `429` or `503` when the ingress spool is full or unavailable.
- Worker states: `incoming`, `processing`, `retry`, `completed`, `quarantine`.

- [ ] Write failing tests proving that a report is not acknowledged before durable persistence.
- [ ] Write failing tests for duplicate reports, malformed payloads, oversized payloads, worker crashes, and database unavailability.
- [ ] Implement per-agent authentication and bind the authenticated identity to the reported agent ID.
- [ ] Implement the persistent spool and worker claim protocol using atomic rename.
- [ ] Add idempotent processing keyed by stable event/report IDs.
- [ ] Add retry with bounded backoff and quarantine with a visible reason.
- [ ] Run tests with the database unavailable and confirm the ingress endpoint still accepts data until the spool limit is reached.

### Task 6: Add phase-aware delivery instrumentation

**Files:**
- Modify: `blackwatch/agents/ingress.py`
- Modify: `blackwatch/services/agent_ingest_worker.py`
- Modify: `blackwatch/storage.py`
- Modify: agent status API/UI from Phase 1
- Test: latency and sequence-gap tests

- [ ] Record `observed_at`, `collected_at`, `sent_at`, `accepted_at`, and `processed_at` without overwriting earlier timestamps.
- [ ] Record per-agent sequence gaps, retry counts, queue age, and dropped-event counts.
- [ ] Display the exact delayed boundary in the UI.
- [ ] Add an operator-readable report showing critical-event p95 acceptance and processing latency.
- [ ] Run a controlled test with delayed PostgreSQL processing and verify that the agent remains healthy while processing is reported as delayed.

**Phase 2 gate:** A single canary agent must run on direct HTTPS while SQS remains available as rollback. Direct ingress must survive a simulated database outage, preserve critical events locally, deduplicate retransmissions, and provide phase-specific diagnostics.

---

## Phase 3: Optimize latency and cut over safely

**Outcome:** All selected EC2/VPN agents use the direct path, with measurable latency and a controlled fallback.

### Task 7: Canary rollout and comparison

**Files:**
- Modify: deployment configuration and agent installer only after the canary is approved
- Modify: operator documentation
- Test: deployment smoke tests and rollback tests

- [ ] Select one non-critical EC2 instance as the canary.
- [ ] Run direct HTTPS for at least one complete operational window while recording SQS-vs-direct delivery and processing metrics.
- [ ] Verify critical events arrive within the agreed latency target and bulk events do not starve them.
- [ ] Verify agent restart, network outage, server outage, database outage, and spool recovery.
- [ ] Verify rollback to SQS without deleting local state or database data.

### Task 8: Tune collector and transfer cadences

**Files:**
- Modify: agent cadence configuration
- Modify: collector scheduling only where measurements justify it
- Test: event freshness and resource-budget tests

- [ ] Set critical event delivery to immediate or a maximum two-second micro-batch.
- [ ] Keep bulk heartbeat/snapshot delivery at a bounded cadence appropriate to each collector.
- [ ] Ensure a large snapshot cannot block critical event delivery.
- [ ] Measure CPU, memory, network, local spool growth, and database write load on each instance class.
- [ ] Tune only from measured queue age and processing latency, not from guesswork.

### Task 9: Full rollout and SQS retirement decision

**Files:**
- Modify: deployment documentation and production configuration after approval
- Modify: UI copy and operational runbook
- Test: final end-to-end verification suite

- [ ] Roll out one agent at a time and verify its delivery dashboard before continuing.
- [ ] Require no unexplained sequence gaps, no critical queue loss, and no false agent-stopped alerts during the observation window.
- [ ] Keep SQS disabled only through configuration first; retain the implementation until the direct path has proven stable.
- [ ] Remove SQS-specific deployment only as a separate operator-approved change.
- [ ] Document the exact rollback procedure and the meaning of every health state.

## Acceptance Targets

- Critical events: p95 server acceptance under 2 seconds during normal operation.
- Critical events: p95 UI/projection visibility under 5 seconds during normal operation.
- No agent is labeled stopped solely because PostgreSQL processing is delayed.
- Duplicate delivery does not create duplicate stored events or notifications.
- Agent reboot does not create false sequence-gap alarms.
- Server or network outage preserves critical events until the configured spool policy is exhausted.
- Every dropped, quarantined, delayed, or rejected payload has an operator-visible reason.
- Bulk snapshots cannot block critical events.

