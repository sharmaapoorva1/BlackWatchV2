-- Phase 1 agent delivery observability. Additive only: one current row per
-- agent, retaining the latest transport and processing measurements.
CREATE TABLE IF NOT EXISTS agent_delivery_status (
    agent_id                    TEXT PRIMARY KEY,
    boot_id                     TEXT,
    last_sequence               BIGINT,
    last_report_id              TEXT,
    last_observed_at            TIMESTAMPTZ,
    last_collected_at           TIMESTAMPTZ,
    last_sent_at                TIMESTAMPTZ,
    last_accepted_at            TIMESTAMPTZ,
    last_processed_at           TIMESTAMPTZ,
    queue_delay_seconds         DOUBLE PRECISION,
    processing_delay_seconds    DOUBLE PRECISION,
    sequence_gaps               BIGINT NOT NULL DEFAULT 0,
    last_error                  TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_delivery_updated
    ON agent_delivery_status (updated_at DESC);
