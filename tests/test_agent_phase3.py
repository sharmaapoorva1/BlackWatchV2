from pathlib import Path
import pytest


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


def test_process_snapshot_excludes_command_line_arguments(monkeypatch):
    import subprocess
    import scripts.ec2_agent as agent

    monkeypatch.setattr(agent.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(
        args=a[0], returncode=0,
        stdout="USER PID COMMAND\nroot 1 systemd\n",
        stderr="",
    ))
    assert agent.snapshot_processes() == [{"user": "root", "pid": "1", "comm": "systemd"}]


def test_agent_reports_per_collector_state_and_cadence():
    import scripts.ec2_agent as agent

    collector = agent.Collector("sample", lambda: [1], 30)
    collector.maybe_run(100.0)
    status = collector.status(110.0)
    assert status == {
        "state": "ok", "interval_seconds": 30,
        "last_attempt_at": "1970-01-01T00:01:40+00:00",
        "last_success_at": "1970-01-01T00:01:40+00:00",
        "age_seconds": 10, "error": None,
    }
    assert collector.status(191.0)["state"] == "stale"


def test_sequence_gap_tracker_resolves_out_of_order_reports_and_bounds_ranges():
    from blackwatch.agents.delivery import update_missing_sequence_ranges

    ranges, gaps, overflow = update_missing_sequence_ranges([], 0, 10, max_ranges=8)
    assert ranges == [[1, 9]] and gaps == 9 and overflow is False
    ranges, gaps, overflow = update_missing_sequence_ranges(ranges, 10, 5, max_ranges=8)
    assert ranges == [[1, 4], [6, 9]] and gaps == 8 and overflow is False
    ranges, gaps, overflow = update_missing_sequence_ranges(ranges, 10, 3, max_ranges=8)
    assert ranges == [[1, 2], [4, 4], [6, 9]] and gaps == 7 and overflow is False
    split_ranges = [[n, n] for n in range(1, 12, 2)]
    bounded, _, overflow = update_missing_sequence_ranges(split_ranges, 11, 12, max_ranges=4)
    assert len(bounded) == 4 and overflow is True


def test_report_schema_v2_is_validated_but_legacy_v1_remains_accepted():
    from blackwatch.agents.ingress import validate_report, IngressValidationError
    legacy = {
        "agent_id": "i-123", "report_id": "r-1", "boot_id": "boot-1",
        "sequence": 1, "collected_at": "2026-10-21T12:00:00+00:00",
    }
    assert validate_report(legacy, "i-123", 10_000) == legacy
    current = {**legacy, "report_schema_version": 2, "host": {"instance_id": "i-123"},
               "collector_status": {"ports": {"state": "ok"}}}
    assert validate_report(current, "i-123", 10_000) == current
    bad_time = {**current, "collected_at": "not-a-time"}
    with pytest.raises(IngressValidationError):
        validate_report(bad_time, "i-123", 10_000)
    wrong_host = {**current, "host": {"instance_id": "i-other"}}
    with pytest.raises(IngressValidationError):
        validate_report(wrong_host, "i-123", 10_000)


def test_adapter_keeps_https_as_the_event_transport():
    from datetime import datetime, timezone
    from blackwatch.modules.base import IngestContext
    from blackwatch.modules.ec2_host import Ec2HostAdapter

    raw = {"kind": "ec2_report", "host": {"instance_id": "i-abc12345"},
           "collected_at": "2026-10-21T12:00:00+00:00", "report_schema_version": 2}
    event = Ec2HostAdapter().parse(raw, IngestContext(
        module="ec2.host", transport="https",
        received_at=datetime(2026, 10, 21, 12, 0, 1, tzinfo=timezone.utc),
    ))[0]
    assert event.source.transport.value == "https"
    assert event.extra["report_schema_version"] == 2


def test_agent_collects_tcp_and_udp_listeners(monkeypatch):
    import subprocess
    import scripts.ec2_agent as agent

    monkeypatch.setattr(agent.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(
        args=a[0], returncode=0,
        stdout=("Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process\n"
                'tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=1,fd=3))\n'
                'udp UNCONN 0 0 0.0.0.0:53 0.0.0.0:* users:(("dns",pid=2,fd=3))\n'),
        stderr="",
    ))
    assert agent.snapshot_ports() == [
        {"proto": "tcp", "address": "0.0.0.0", "port": "22", "process": "sshd"},
        {"proto": "udp", "address": "0.0.0.0", "port": "53", "process": "dns"},
    ]


def test_authorized_key_fingerprint_uses_openssh_sha256_format():
    import base64
    import scripts.ec2_agent as agent

    blob = base64.b64encode(b"example-public-key-blob").decode()
    assert agent.ssh_key_fingerprint(blob) == agent.ssh_key_fingerprint(blob)
    assert agent.ssh_key_fingerprint(blob).startswith("SHA256:")


def test_user_snapshot_classifies_accounts_and_includes_groups(monkeypatch):
    import subprocess
    import scripts.ec2_agent as agent
    def run(args, **kwargs):
        if args[:2] == ["getent", "passwd"]:
            return subprocess.CompletedProcess(args, 0, "alice:x:1001:1001::/home/alice:/bin/bash\nsvc:x:80:80::/nonexistent:/usr/sbin/nologin\n", "")
        if args[:2] == ["getent", "group"]:
            return subprocess.CompletedProcess(args, 0, "sudo:x:27:alice\nwheel:x:10:alice\n", "")
        raise AssertionError(args)
    monkeypatch.setattr(agent.subprocess, "run", run)
    users = agent.snapshot_users()
    alice = next(u for u in users if u["name"] == "alice")
    assert alice["account_type"] == "human_or_local"
    assert alice["groups"] == ["sudo", "wheel"]
    assert alice["sudo_wheel_member"] is True
    assert alice["account_status"] == "unknown"


def test_disk_snapshot_has_distinct_sample_times(monkeypatch):
    import subprocess
    import scripts.ec2_agent as agent
    calls = iter([
        subprocess.CompletedProcess([], 0, "Filesystem Type 1024-blocks Used Available Capacity Mounted on\n/dev/x ext4 1000 500 500 50% /\n", ""),
        subprocess.CompletedProcess([], 0, "Filesystem Inodes IUsed IFree IUse% Mounted on\n/dev/x 100 50 50 50% /\n", ""),
    ])
    monkeypatch.setattr(agent.subprocess, "run", lambda *a, **k: next(calls))
    stamps = iter(["bytes-time", "inode-time"])
    monkeypatch.setattr(agent, "_utc_now", lambda: next(stamps))
    row = agent.snapshot_disk()[0]
    assert row["bytes_sampled_at"] == "bytes-time"
    assert row["inodes_sampled_at"] == "inode-time"


def test_sudo_journal_records_drop_arbitrary_command_arguments(monkeypatch):
    import json
    import subprocess
    import scripts.ec2_agent as agent
    now = agent.datetime.now(agent.timezone.utc)
    payload = {"__CURSOR": "c1", "__REALTIME_TIMESTAMP": str(int(now.timestamp() * 1_000_000)),
               "MESSAGE": "sudo: alice : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/cat --token=secret /etc/shadow"}
    monkeypatch.setattr(agent.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess([], 0, json.dumps(payload), ""))
    result = agent.read_auth_events(300)
    parsed = json.loads(result[0])
    assert parsed["MESSAGE"] == "sudo: alice : USER=root ; COMMAND=cat"
    assert parsed["__CURSOR"] == "c1"


def test_systemd_snapshot_separates_enabled_active_and_running(monkeypatch):
    import subprocess
    import scripts.ec2_agent as agent
    results = iter([
        subprocess.CompletedProcess([], 0, "sshd.service enabled enabled\nbackup.service disabled disabled\n", ""),
        subprocess.CompletedProcess([], 0,
            "sshd.service loaded active running OpenSSH\nbackup.service loaded active exited Backup\ncleanup.timer loaded active waiting Cleanup\n", ""),
    ])
    monkeypatch.setattr(agent.subprocess, "run", lambda *a, **k: next(results))
    assert agent.snapshot_systemd_units() == {
        "enabled": ["sshd.service"],
        "active": ["backup.service", "cleanup.timer", "sshd.service"],
        "running": ["sshd.service"],
    }


def test_package_details_label_install_time_source(monkeypatch):
    import subprocess
    import scripts.ec2_agent as agent
    monkeypatch.setattr(agent, "distro_family", lambda: "dpkg")
    monkeypatch.setattr(agent.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(
        args=a[0], returncode=0, stdout="openssh\t9.2-1\n", stderr=""))
    assert agent.snapshot_package_details() == [{
        "name": "openssh", "version": "9.2-1", "installed_at": None,
        "install_time_source": "unavailable",
    }]


def test_host_diff_tracks_active_service_state_and_inode_pressure():
    from blackwatch.hosts.diff import diff_snapshots

    previous = {
        "systemd_units": {"enabled": ["sshd.service"], "active": ["sshd.service"], "running": ["sshd.service"]},
        "disk": [{"mount": "/", "fs_type": "xfs", "used_pct": 50,
                  "inodes_used_pct": 50, "inodes_total": 1000, "inodes_used": 500}],
    }
    current = {
        "systemd_units": {"enabled": ["sshd.service"], "active": ["sshd.service", "timer.service"], "running": ["sshd.service"]},
        "disk": [{"mount": "/", "fs_type": "xfs", "used_pct": 50,
                  "inodes_used_pct": 96, "inodes_total": 1000, "inodes_used": 960}],
    }
    changes = dict(diff_snapshots(previous, current))
    assert not any(action.startswith("host.service.") for action in changes)
    assert changes["host.disk.critical"]["mount"] == "/"
    assert changes["host.disk.critical"]["capacity_kind"] == "inodes"
