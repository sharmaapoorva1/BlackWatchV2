-- Phase 2 direct agent ingress receipt state. Additive only.
CREATE TABLE IF NOT EXISTS agent_ingress_receipts (
    agent_id                TEXT NOT NULL,
    report_id               TEXT NOT NULL,
    state                   TEXT NOT NULL,
    attempts                BIGINT NOT NULL DEFAULT 0,
    accepted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_started_at   TIMESTAMPTZ,
    processed_at            TIMESTAMPTZ,
    retry_at                TIMESTAMPTZ,
    last_error              TEXT,
    quarantine_reason       TEXT,
    stats                   JSONB,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_ingress_state_retry
    ON agent_ingress_receipts (state, retry_at, updated_at);

CREATE INDEX IF NOT EXISTS idx_agent_ingress_updated
    ON agent_ingress_receipts (updated_at DESC);
