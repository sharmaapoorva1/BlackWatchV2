-- Phase 3 transfer metrics. Additive only; retain all existing delivery data.
ALTER TABLE agent_delivery_status
    ADD COLUMN IF NOT EXISTS transport TEXT,
    ADD COLUMN IF NOT EXISTS rollout TEXT;

ALTER TABLE agent_ingress_receipts
    ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS priority TEXT,
    ADD COLUMN IF NOT EXISTS transport TEXT,
    ADD COLUMN IF NOT EXISTS rollout TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_ingress_transport_accepted
    ON agent_ingress_receipts (transport, accepted_at DESC);
