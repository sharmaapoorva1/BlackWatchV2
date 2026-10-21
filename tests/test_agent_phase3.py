from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_critical_only_report_is_not_emitted_without_critical_findings(monkeypatch):
    import scripts.ec2_agent as agent

    monkeypatch.setattr(agent, "host_identity", lambda: {"instance_id": "i-test"})
    monkeypatch.setattr(agent, "read_auth_events", lambda *_: [])
    monkeypatch.setattr(agent, "detect_oom_events", lambda *_: [])
    monkeypatch.setattr(agent, "next_sequence", lambda: 1)
    monkeypatch.setattr(agent, "boot_id", lambda: "boot-test")
    monkeypatch.setattr(agent, "_FIM_ENGINE", None)

    assert agent.build_report(critical_only=True) is None


def test_critical_only_report_contains_fim_and_skips_bulk_snapshots(monkeypatch):
    import scripts.ec2_agent as agent

    class FakeFim:
        def drain_changes(self):
            return [{"path": "/etc/ssh/sshd_config", "change": "modified"}]

        def coverage(self):
            return {"inotify_active": True}

    monkeypatch.setattr(agent, "host_identity", lambda: {"instance_id": "i-test"})
    monkeypatch.setattr(agent, "read_auth_events", lambda *_: [])
    monkeypatch.setattr(agent, "detect_oom_events", lambda *_: [])
    monkeypatch.setattr(agent, "next_sequence", lambda: 7)
    monkeypatch.setattr(agent, "boot_id", lambda: "boot-test")
    monkeypatch.setattr(agent, "_FIM_ENGINE", FakeFim())

    report = agent.build_report(critical_only=True)

    assert report is not None
    assert report["priority_counts"]["critical"] == 1
    assert "fim_changes" in report
    assert "snapshots" not in report


def test_delivery_stamp_preserves_first_send_time():
    from scripts.agent_transport import stamp_report

    payload = {"sent_at": "2026-10-21T10:00:00+00:00"}
    stamped = stamp_report(
        payload,
        transport_name="https",
        rollout="phase3-canary",
        now="2026-10-21T10:01:00+00:00",
    )

    assert stamped["sent_at"] == "2026-10-21T10:00:00+00:00"
    assert stamped["transport"] == "https"
    assert stamped["rollout"] == "phase3-canary"


def test_phase3_migration_and_diagnostics_contract():
    migration = ROOT / "blackwatch" / "sql" / "044_agent_transfer_metrics.sql"
    sql = migration.read_text(encoding="utf-8")
    assert "ADD COLUMN IF NOT EXISTS sent_at" in sql
    assert "ADD COLUMN IF NOT EXISTS transport" in sql
    assert "percentile_cont" in (ROOT / "blackwatch" / "storage.py").read_text(encoding="utf-8")
    assert '"metrics"' in (ROOT / "blackwatch" / "api.py").read_text(encoding="utf-8")


def test_phase3_installer_carries_cadence_and_rollout_settings():
    installer = (ROOT / "deploy" / "ec2" / "install-agent.sh").read_text(encoding="utf-8")
    assert "BLACKWATCH_ROLLOUT" in installer
    assert "CRITICAL_INTERVAL_SEC" in installer
