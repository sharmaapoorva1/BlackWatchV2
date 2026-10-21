# BlackWatch Phase 2: Agent Direct Transfer

**Date:** 2026-10-21  
**Status:** Approved for specification; implementation follows a separate plan.  
**Scope:** EC2 agent delivery only. Existing SQS connectors remain supported.

## Purpose

BlackWatch Phase 1 now distinguishes collection, transport acceptance, and
database processing. Phase 2 adds a BlackWatch-owned HTTPS delivery path so a
healthy EC2 agent is not dependent on SQS polling latency or SQS backlog
behavior.

The direct path must improve normal-case latency without weakening durability,
duplicate protection, or the existing SQS rollback path.

## Goals

- Send the existing EC2 report envelope directly to BlackWatch over HTTPS.
- Preserve SQS as a selectable, working compatibility transport.
- Acknowledge a report only after durable server-side admission.
- Keep critical reports ahead of bulk telemetry during local recovery.
- Survive temporary database or worker outages without losing admitted reports.
- Make retries, backpressure, duplicates, quarantine, and latency visible.
- Avoid changing event meaning, collector behavior, or Postgres storage volume.

## Non-goals

- Removing SQS in Phase 2.
- Sending agents directly to PostgreSQL.
- Splitting one existing report into separately acknowledged event batches.
- General-purpose remote command execution.
- Rewriting the existing collector or notification pipelines.
- Changing or recreating `bw_pgdata`.

## Selected architecture

### Agent transport

`scripts/agent_transport.py` defines the small transport contract:

```text
Transport.send(batch: bytes, *, priority: str) -> SendResult
```

`SendResult` contains `accepted`, `ack_id`, `accepted_at`, optional
`retry_after`, and `error_category`.

The agent selects the implementation with:

- `BLACKWATCH_TRANSPORT=sqs|https` (default: `sqs`)
- `BLACKWATCH_SQS_URL` for the existing SQS implementation
- `BLACKWATCH_INGEST_URL` for the HTTPS implementation
- `BLACKWATCH_AGENT_TOKEN` for the per-agent HTTPS credential

The server keeps the corresponding allowlist in
`BLACKWATCH_AGENT_TOKENS=agent-id-1:token-1,agent-id-2:token-2`. The token
mapping is loaded at startup and is never returned by an API or included in
diagnostic output.

The HTTPS implementation uses the Python standard library available on the
existing Amazon Linux 2 agent, persistent HTTPS connections, bounded connect
and read timeouts, a bounded request body, and gzip for bulk reports. It
accepts only `2xx` responses. `429` and `503` preserve the response retry
delay when valid; other failures use bounded exponential backoff.

The existing local spool remains the agent's outage buffer, but each spool
record stores its priority and is written with a private temporary file followed
by an atomic rename. Recovery drains critical records first, then bulk records.
Spool limits remain bounded; when limits are exhausted, the agent logs an
explicit drop reason and keeps trying to preserve critical records according to
the configured policy.

The existing report JSON remains one logical submission. A report containing
critical findings is prioritized as critical; otherwise it is bulk/normal.
This avoids event duplication and reordering while the new transport is being
validated.

### Durable server ingress

The app exposes:

```text
POST /api/agent/v1/reports
```

The endpoint is exempt from the browser session middleware but is not
anonymous. It requires a bearer token configured for the specific agent. The
server resolves the authenticated `agent_id` from the token and rejects a
payload whose `agent_id` does not match it. Tokens are compared in constant
time and are never written to audit summaries or application logs.

The request is accepted only when:

- the body is valid JSON;
- it is within the configured maximum size;
- it has the required report identity and agent metadata;
- the authenticated agent identity matches the body;
- the persistent ingress spool has capacity; and
- the body has been atomically persisted with private permissions.

The endpoint returns `202` only after the final spool file is durable. It
returns `400`/`422` for invalid input, `401` for invalid credentials, and
`429` or `503` when the spool is full or unavailable. It never invokes the
database pipeline synchronously.

The ingress spool is a separate named Compose volume, mounted by the app and
worker. It is not the Postgres volume. Spool files use a deterministic path
based on authenticated agent and report ID, so a retransmission can be
recognized safely.

### Worker and processing states

`blackwatch/services/agent_ingest_worker.py` claims files with atomic rename
into a processing area. It then calls the existing `pipeline.ingest_payload`
path with `transport="https"` and the original collection/receipt metadata.

Each report is tracked through:

```text
incoming -> processing -> completed
                    \-> retry -> processing
                    \-> quarantine
```

A small additive receipt table records report ID, agent ID, state, attempts,
timestamps, last error, and quarantine reason. A completed report is not
processed again. A crashed/stale processing claim is recoverable after a lease
timeout. Database errors return the report to retry without rejecting already
admitted data. Malformed reports that cannot be safely retried are moved to
quarantine and remain inspectable.

The worker is a separate Compose service using the existing application image.
This isolates worker failure/restart from the HTTP admission process and avoids
adding an unbounded background thread to the API process.

### Security boundary

- HTTPS is required for the direct transport in production.
- Each agent receives a token scoped to one agent identity.
- The server binds token identity to the report's `agent_id`.
- Request size, JSON shape, and spool capacity are bounded.
- Spool and temporary files are mode `0600`; directories are `0700`.
- Tokens and payload secrets are excluded from audit output and logs.
- Existing SQS IAM behavior is unchanged.

## Data flow

```text
EC2 collector
  -> report envelope
  -> priority selection
  -> HTTPS transport (or SQS compatibility transport)
  -> authenticated durable ingress spool
  -> worker claim
  -> idempotent receipt check
  -> existing normalization/pipeline
  -> delivery status: accepted and processed
```

The existing Phase 1 timestamps remain separate:

`collected_at -> sent_at -> accepted_at -> processed_at`.

No later timestamp overwrites an earlier timestamp, and delayed processing does
not make a recently accepted agent appear silent.

## Failure behavior

- **Agent cannot connect:** retain the report locally, retry with bounded
  backoff, and continue systemd watchdog heartbeats.
- **Ingress returns 429/503:** honor `Retry-After` when valid, otherwise use
  bounded backoff; do not discard the report.
- **Ingress process restarts:** admitted files remain on the named volume.
- **Database is unavailable:** worker retries; HTTP admission continues until
  spool capacity is reached.
- **Duplicate report:** return an accepted/duplicate response and do not run
  the pipeline twice.
- **Malformed report:** reject before admission when possible; quarantine any
  admitted payload that fails worker validation, with a visible reason.
- **Spool full/unavailable:** return explicit backpressure and expose the
  condition in delivery diagnostics.
- **Rollback:** change the agent transport setting back to `sqs`; no database
  or spool deletion is required.

## Observability and UI

The existing delivery status API/UI is extended with direct-ingress metrics:

- transport (`https` or `sqs`);
- accepted, processed, retry, and quarantine counts;
- queue age and retry age;
- last backpressure/error category;
- report ID and operation state where applicable;
- acceptance and processing latency.

The operator can distinguish agent collection failure, network/delivery delay,
server admission backpressure, worker/database delay, and quarantined data.

## Testing and acceptance

Tests are written before implementation and must cover:

1. SQS and HTTPS transports satisfy the same contract.
2. Critical records drain before bulk records.
3. Timeout, connection refusal, `429`, and `503` preserve spool state and
   retry behavior.
4. Atomic spool writes never expose partial payloads.
5. Ingress does not return `202` before durable persistence.
6. Authenticated agent identity cannot be forged in the body.
7. Duplicate reports are acknowledged without duplicate pipeline processing.
8. Worker retry, stale-claim recovery, quarantine, and database outage work.
9. Oversized/malformed reports do not block other agents.
10. Phase 1 delivery metrics remain truthful for both transports.

The Phase 2 gate is met only after one non-critical canary runs over HTTPS
while SQS remains available, a simulated database outage preserves admitted
reports, retransmission is deduplicated, and the UI shows the delayed boundary
instead of a generic stale state.

## Deployment safety

The application image, worker service, and new ingress volume are deployed
separately from database storage changes. No command may use
`docker compose down -v`, remove `bw_pgdata`, truncate/delete existing data, or
alter existing tables destructively. SQS remains enabled until the canary and
rollback checks are complete.
