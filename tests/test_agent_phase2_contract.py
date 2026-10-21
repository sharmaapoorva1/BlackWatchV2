from pathlib import Path

from blackwatch.db_safety import assert_migration_safe


ROOT = Path(__file__).resolve().parents[1]


def test_compose_adds_only_separate_ingress_storage_and_worker():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    assert "bw_pgdata:/var/lib/postgresql/data" in compose
    assert "name: blackwatch_bw_pgdata" in compose
    assert "external: true" in compose
    assert "bw_agent_ingress" in compose
    assert "blackwatch.services.agent_ingest_worker" in compose
    assert "BLACKWATCH_AGENT_TOKENS" in compose


def test_direct_ingress_migration_is_additive_and_stateful():
    migration = ROOT / "blackwatch" / "sql" / "043_agent_ingress.sql"
    sql = migration.read_text(encoding="utf-8")
    assert_migration_safe(sql)
    assert "CREATE TABLE IF NOT EXISTS agent_ingress_receipts" in sql
    assert "PRIMARY KEY (agent_id, report_id)" in sql
    assert "quarantine" in sql

