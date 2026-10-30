-- Track unresolved gaps separately from the cumulative historical count.
-- Priority-aware spool replay may deliver reports out of order; late arrivals
-- resolve these ranges without erasing the cumulative audit metric.
ALTER TABLE agent_delivery_status
    ADD COLUMN IF NOT EXISTS missing_sequence_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS pending_sequence_gaps BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sequence_tracking_overflow BOOLEAN NOT NULL DEFAULT FALSE;
