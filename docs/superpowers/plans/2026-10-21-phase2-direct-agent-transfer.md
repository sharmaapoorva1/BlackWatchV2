# BlackWatch Phase 2 Direct Agent Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a BlackWatch-owned HTTPS transport with durable admission, priority-aware recovery, idempotent processing, and phase-specific diagnostics while retaining SQS as the rollback path.

**Architecture:** The EC2 agent sends the existing report envelope through a small transport interface selected by `BLACKWATCH_TRANSPORT`. HTTPS writes to a persistent BlackWatch ingress spool and returns `202` only after atomic persistence; a separate worker drains that spool through the existing pipeline. SQS remains unchanged and selectable.

**Tech Stack:** Python 3.7-compatible agent code, Python 3.12 FastAPI service, PostgreSQL additive migration, Docker Compose named volume, pytest, existing Next.js UI.

**Spec:** `docs/superpowers/specs/2026-10-21-agent-direct-transfer-design.md`

## Global Constraints

- Preserve the existing `bw_pgdata` volume and never use `docker compose down -v`.
- All database changes must be additive and data-preserving.
- Do not remove SQS until the direct path has passed the canary and acceptance gates.
- Do not send agents directly to PostgreSQL.
- Do not return a successful transport acknowledgment until the payload is durably persisted.
- Use at-least-once delivery with idempotent event handling; do not claim exactly-once delivery.
- Do not add arbitrary remote shell execution or general-purpose remote command capability.
- Keep deployment/storage changes separate from application changes.

## Review Focus

- A report accepted by HTTPS while PostgreSQL is unavailable must remain recoverable; Task 3 tests worker retry and stale-claim recovery.
- A retransmitted report must not duplicate pipeline processing or notifications; Task 3 tests receipt idempotency.
- A forged `agent_id` must not pass authentication; Task 2 tests token-to-agent binding.
- A full spool must return explicit backpressure without deleting critical reports; Task 2 tests `429`/`503` and capacity accounting.
- A partial file or malformed payload must not block other agents; Task 2 tests atomic writes and Task 3 tests quarantine.

## File Map

- `scripts/agent_transport.py` — agent-side transport contract, SQS/HTTPS implementations, result model, priority selection.
- `scripts/ec2_agent.py` — select transport, stamp delivery metadata, use priority-aware spool/retry behavior.
- `tests/test_agent_transport.py` — transport contract, HTTP outcomes, ordering, retry-after, and spool tests.
- `blackwatch/agents/ingress.py` — request authentication, report validation, server configuration parsing.
- `blackwatch/agents/spool.py` — atomic durable ingress files, capacity, claim, retry, completion, quarantine.
- `tests/test_agent_ingress.py` — ingress validation/auth/spool behavior.
- `blackwatch/sql/043_agent_ingress.sql` — additive report receipt state table.
- `blackwatch/storage.py` — receipt claim, completion, retry, quarantine, and diagnostics queries.
- `blackwatch/services/agent_ingest_worker.py` — independent spool worker and retry loop.
- `tests/test_agent_ingest_worker.py` — worker idempotency, retry, stale claims, and quarantine.
- `blackwatch/api.py` — direct report endpoint and ingress diagnostics endpoint.
- `blackwatch/main.py` — public-path exception for machine ingress.
- `blackwatch/config.py` — direct-ingress settings and per-agent token map.
- `docker-compose.yml` — app/worker ingress volume and environment only; leave `bw_pgdata` unchanged.
- `tests/test_agent_phase2_contract.py` — Compose and migration safety checks.
- `blackwatch-ui/app/hosts/page.tsx` — display per-agent direct transport and ingress state in the host list.
- `blackwatch-ui/app/hosts/[id]/page.tsx` — display the selected agent's phase timestamps, latency, retries, and quarantine state.
- `blackwatch-ui/lib/types.ts` — additive response types for ingress diagnostics.

---

### Task 1: Agent transport abstraction and priority-aware local delivery

**Files:**
- Create: `scripts/agent_transport.py`
- Modify: `scripts/ec2_agent.py` around configuration, spool, send, and `main`
- Create: `tests/test_agent_transport.py`

**Interfaces:**
- `Transport.send(batch: bytes, *, priority: str) -> SendResult`
- `SendResult(accepted: bool, ack_id: str | None, accepted_at: datetime | None, retry_after: float | None, error_category: str | None)`
- `priority_for_report(payload: dict) -> str`, returning `critical` when the report has critical findings and `bulk` otherwise.
- `build_transport() -> Transport`, selecting `sqs` by default and `https` when configured.

- [ ] **Step 1: Write failing tests** for `SendResult`, priority selection, SQS adapter delegation, HTTPS `202`, HTTPS timeout/connection refusal, `429`/`503` retry-after parsing, bounded request size, and critical-before-bulk spool ordering.
- [ ] **Step 2: Run the focused tests and verify they fail** because the transport module and integration do not exist.
- [ ] **Step 3: Implement the transport contract** using Python 3.7-compatible dataclasses and `http.client.HTTPSConnection`; do not add a third-party agent dependency.
- [ ] **Step 4: Move the existing SQS send behavior behind the contract** without changing queue URL validation, payload shrinking, or IAM usage.
- [ ] **Step 5: Add HTTPS configuration and strict timeout behavior**; send gzip only for bulk payloads and preserve server `Retry-After` for `429`/`503`.
- [ ] **Step 6: Update the existing agent spool** to write a temporary `0600` file, atomically rename it, store priority, and drain critical records before bulk records.
- [ ] **Step 7: Run the focused tests and verify all pass** for success, timeout, refusal, backpressure, and recovery scenarios.
- [ ] **Step 8: Commit** with `feat: add agent transport abstraction` when repository Git permissions allow commits; otherwise record the uncommitted state for the operator.

### Task 2: Authenticated durable ingress spool

**Files:**
- Create: `blackwatch/agents/ingress.py`
- Create: `blackwatch/agents/spool.py`
- Modify: `blackwatch/config.py`
- Modify: `blackwatch/api.py`
- Modify: `blackwatch/main.py`
- Create: `tests/test_agent_ingress.py`

**Interfaces:**
- `parse_agent_tokens(raw: str) -> dict[str, str]`
- `authenticate_agent(authorization: str | None, tokens: dict[str, str]) -> str`
- `validate_report(payload: object, authenticated_agent_id: str, max_bytes: int) -> dict[str, Any]`
- `IngressSpool.persist(agent_id: str, report_id: str, payload: bytes, priority: str) -> PersistResult`
- `IngressSpool.claim() -> ClaimedReport | None`
- `IngressSpool.retry(claim: ClaimedReport, reason: str, retry_at: datetime) -> None`
- `IngressSpool.complete(claim: ClaimedReport) -> None`
- `IngressSpool.quarantine(claim: ClaimedReport, reason: str) -> None`
- `POST /api/agent/v1/reports` returns `202` only after `persist()` succeeds.

- [ ] **Step 1: Write failing tests** for token parsing, constant-time token matching, missing/invalid bearer tokens, identity mismatch, invalid JSON, missing report identity, oversized bodies, duplicate paths, atomic persistence, and capacity rejection.
- [ ] **Step 2: Run the focused tests and verify they fail** because the ingress/auth/spool interfaces do not exist.
- [ ] **Step 3: Implement configuration parsing** for server-side `BLACKWATCH_AGENT_TOKENS`, ingress directory, maximum file count, maximum bytes, request size, and lease duration; never expose token values.
- [ ] **Step 4: Implement authentication and validation** with constant-time token comparison and a required `agent_id`, `report_id`, `boot_id`, `sequence`, and `collected_at` envelope.
- [ ] **Step 5: Implement the filesystem spool** with `0700` directories, `0600` files, temporary-file-plus-rename persistence, deterministic duplicate paths, and explicit capacity errors.
- [ ] **Step 6: Add the direct API route** and public-path exception while leaving browser session authentication required everywhere else; do not call the database pipeline from the request handler.
- [ ] **Step 7: Run the focused tests and verify** that accepted files survive process restart simulation, duplicates are recognized, invalid data is rejected, and full/unavailable spools return backpressure.
- [ ] **Step 8: Commit** with `feat: add durable authenticated agent ingress` when Git permissions allow commits.

### Task 3: Receipt state, idempotent worker, retries, and quarantine

**Files:**
- Create: `blackwatch/sql/043_agent_ingress.sql`
- Modify: `blackwatch/storage.py`
- Create: `blackwatch/services/agent_ingest_worker.py`
- Create: `tests/test_agent_ingest_worker.py`
- Modify: `blackwatch/pipeline.py` only if the existing metadata seam needs an additive argument

**Interfaces:**
- Receipt states: `incoming`, `processing`, `retry`, `completed`, `quarantine`.
- `storage.claim_agent_report(agent_id: str, report_id: str, lease_seconds: int) -> bool`
- `storage.complete_agent_report(agent_id: str, report_id: str, processed_at: datetime, stats: dict[str, Any]) -> None`
- `storage.retry_agent_report(agent_id: str, report_id: str, error: str, retry_at: datetime) -> None`
- `storage.quarantine_agent_report(agent_id: str, report_id: str, reason: str) -> None`
- `run_once(spool: IngressSpool, now: datetime | None = None) -> WorkerResult`

- [ ] **Step 1: Write failing tests** for receipt-table state transitions, duplicate completion, database failure retry, stale processing lease recovery, malformed-payload quarantine, and a worker failure that leaves the spool item recoverable.
- [ ] **Step 2: Run the focused tests and verify they fail** because migration/storage/worker behavior does not exist.
- [ ] **Step 3: Add the receipt migration** with a primary key on `(agent_id, report_id)`, state/check timestamps, attempt count, retry timestamp, last error, and quarantine reason; include no destructive SQL.
- [ ] **Step 4: Implement storage state transitions** with guarded updates so completed reports cannot be processed again and stale processing claims can be recovered.
- [ ] **Step 5: Implement `run_once`** to claim one file, validate it, claim its receipt, call `pipeline.ingest_payload(..., transport="https", received_at=...)`, and complete/retry/quarantine exactly once per outcome.
- [ ] **Step 6: Add bounded exponential retry** with a visible last error and a maximum attempt/quarantine policy; ensure one bad report cannot stop the worker loop.
- [ ] **Step 7: Run focused worker tests and migration safety tests** and verify database-unavailable behavior preserves admitted files.
- [ ] **Step 8: Commit** with `feat: add durable agent ingress worker` when Git permissions allow commits.

### Task 4: Worker service, deployment wiring, and diagnostics

**Files:**
- Modify: `docker-compose.yml`
- Modify: `blackwatch/services/agent_ingest_worker.py` for module entrypoint/loop
- Modify: `blackwatch/api.py` for ingress diagnostics
- Modify: `blackwatch/storage.py` for summary queries if needed
- Create: `tests/test_agent_phase2_contract.py`
- Modify: `blackwatch-ui/app/hosts/page.tsx`
- Modify: `blackwatch-ui/app/hosts/[id]/page.tsx`
- Modify: `blackwatch-ui/lib/types.ts`

**Interfaces:**
- Worker command: `python -m blackwatch.services.agent_ingest_worker`
- `GET /api/agents/ingress` returns transport, spool counts/bytes, accepted/processed/retry/quarantine counts, queue age, and last error without secrets.
- Compose adds `bw_agent_ingress` only; the existing external `blackwatch_bw_pgdata` declaration is unchanged byte-for-byte.

- [ ] **Step 1: Write failing contract tests** that assert the Compose file retains the Postgres volume, defines the separate ingress volume, configures the worker, and exposes no token values in diagnostics.
- [ ] **Step 2: Run the contract tests and verify they fail** before deployment wiring exists.
- [ ] **Step 3: Add the worker service** using the existing app image, database dependency, shared ingress volume, and explicit ingress settings; do not add a database volume change.
- [ ] **Step 4: Add read-only ingress diagnostics** and extend Phase 1 delivery status with direct transport/queue state, keeping existing response fields compatible.
- [ ] **Step 5: Update the existing UI** to show direct transport, server admission delay, retry/backpressure, and quarantine distinctly using existing imported UI components.
- [ ] **Step 6: Run contract tests, Python compilation, UI typecheck, migration safety scan, and the focused Phase 1 regression suite.**
- [ ] **Step 7: Commit** with `feat: wire phase 2 ingress worker and diagnostics` when Git permissions allow commits.

### Task 5: Canary configuration and operator verification

**Files:**
- Modify: `docs/ec2-agent.md` with direct transport configuration and rollback steps
- Modify: `deploy/ec2/install-agent.sh` only for additive environment/config support
- Create: `tests/test_agent_canary_contract.py`

**Interfaces:**
- Agent configuration documents `BLACKWATCH_TRANSPORT`, `BLACKWATCH_INGEST_URL`, and `BLACKWATCH_AGENT_TOKEN` with SQS fallback.
- Rollback is a configuration change back to `BLACKWATCH_TRANSPORT=sqs`; no data deletion or volume recreation.

- [ ] **Step 1: Write failing documentation/config tests** for required HTTPS settings, SQS fallback, HTTPS-only production URL validation, and rollback instructions.
- [ ] **Step 2: Run them and verify they fail** before the operator documentation and installer support exist.
- [ ] **Step 3: Add additive installer/config support** without replacing the existing SQS URL or AWS role behavior.
- [ ] **Step 4: Document the one-canary procedure**: install direct transport on the existing non-critical canary, observe acceptance/processing latency, simulate app/database outage, verify spool recovery and duplicate handling, then roll back if any gate fails.
- [ ] **Step 5: Run the final local contract suite** and report any checks that require execution on the production server because this workstation lacks the production database and canary network.

## Final Phase 2 Gate

Before claiming Phase 2 complete, verify on the selected canary:

- direct HTTPS is active while SQS remains configured as rollback;
- critical reports are admitted within the agreed normal-case latency target;
- a database outage leaves accepted reports on the ingress volume and they process after recovery;
- retransmission does not create duplicate events or notifications;
- malformed/oversized reports are rejected or quarantined visibly;
- the UI distinguishes agent collection, HTTPS admission, worker processing, and quarantine states;
- `bw_pgdata` is present and unchanged before and after deployment.
