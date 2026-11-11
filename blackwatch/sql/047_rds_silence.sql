-- RDS log-pipeline silence flags. Additive and idempotent.
-- One row per database instance whose log feed we have flagged as silent, so
-- the check alerts once per episode and the next real event clears it.

CREATE TABLE IF NOT EXISTS rds_silence_state (
    db_instance TEXT        PRIMARY KEY,
    alerted     BOOLEAN     NOT NULL DEFAULT false,
    alerted_at  TIMESTAMPTZ
);
