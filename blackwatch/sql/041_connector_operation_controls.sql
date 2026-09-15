-- Additive operation controls. Existing operation history is preserved.
ALTER TABLE connector_operations
    ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_connector_operations_queue_priority
    ON connector_operations (priority ASC, requested_at ASC)
    WHERE status = 'queued';
