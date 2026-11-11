-- VPN session history + silent-failure flags. Additive and idempotent.
--
-- vpn_sessions: one row per observed client session, written by the VPN
-- projection from status-snapshot diffs. "Who was connected at time T" and
-- "how long did they stay" become a cheap query instead of a log search.
--
-- vpn_status.agent_stale / no_login_alerted: de-dupe flags so the silence
-- checks alert once per episode, not once per scheduler tick.

CREATE TABLE IF NOT EXISTS vpn_sessions (
    id              BIGSERIAL   PRIMARY KEY,
    server          TEXT        NOT NULL,
    identity        TEXT        NOT NULL,
    common_name     TEXT,
    real_address    TEXT,
    real_ip         TEXT,
    virtual_address TEXT,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    bytes_received  BIGINT,
    bytes_sent      BIGINT
);

CREATE INDEX IF NOT EXISTS vpn_sessions_started_idx ON vpn_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS vpn_sessions_open_idx ON vpn_sessions (server, identity, real_address) WHERE ended_at IS NULL;

ALTER TABLE vpn_status ADD COLUMN IF NOT EXISTS agent_stale BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vpn_status ADD COLUMN IF NOT EXISTS no_login_alerted BOOLEAN NOT NULL DEFAULT false;
