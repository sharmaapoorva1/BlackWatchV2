from datetime import datetime, timedelta, timezone

from blackwatch.agents.delivery import delivery_health, extract_report_metadata
from blackwatch.modules.base import IngestContext
from blackwatch.modules.ec2_host import Ec2HostAdapter


def test_extract_report_metadata_uses_agent_identity_and_transport_timestamps():
    report = {
        "kind": "ec2_report",
        "report_id": "report-123",
        "boot_id": "boot-1",
        "sequence": 42,
        "collected_at": "2026-10-21T10:00:00+00:00",
        "sent_at": "2026-10-21T10:00:02+00:00",
        "priority_counts": {"critical": 1, "normal": 2, "bulk": 1},
        "host": {"instance_id": "i-abc12345"},
    }

    metadata = extract_report_metadata(report)

    assert metadata["agent_id"] == "i-abc12345"
    assert metadata["report_id"] == "report-123"
    assert metadata["sequence"] == 42
    assert metadata["collected_at"].isoformat() == "2026-10-21T10:00:00+00:00"
    assert metadata["sent_at"].isoformat() == "2026-10-21T10:00:02+00:00"
    assert metadata["priority_counts"]["critical"] == 1


def test_ec2_adapter_preserves_collection_time_and_delivery_metadata():
    raw = {
        "kind": "ec2_report",
        "host": {"instance_id": "i-abc12345", "hostname": "edge-1"},
        "agent_id": "i-abc12345",
        "boot_id": "boot-1",
        "sequence": 7,
        "report_id": "report-7",
        "collected_at": "2026-10-21T10:00:00+00:00",
        "sent_at": "2026-10-21T10:00:02+00:00",
        "priority_counts": {"critical": 0, "normal": 1, "bulk": 0},
    }

    event = Ec2HostAdapter().parse(
        raw,
        IngestContext(
            module="ec2.host",
            transport="queue",
            received_at=datetime(2026, 10, 21, 10, 0, 5, tzinfo=timezone.utc),
        ),
    )[0]

    assert event.event_time.isoformat() == "2026-10-21T10:00:00+00:00"
    assert event.extra["sequence"] == 7
    assert event.extra["priority_counts"]["normal"] == 1
    assert event.extra["received_at"] == "2026-10-21T10:00:05+00:00"


def test_delivery_health_separates_queue_delay_from_agent_silence():
    now = datetime(2026, 10, 21, 10, 10, tzinfo=timezone.utc)

    assert delivery_health(
        now=now,
        last_accepted_at=now - timedelta(seconds=20),
        queue_delay_seconds=95,
        processing_delay_seconds=0,
        collector_degraded=False,
        sequence_gaps=0,
    )["state"] == "delivery_delayed"

    assert delivery_health(
        now=now,
        last_accepted_at=now - timedelta(seconds=20),
        queue_delay_seconds=0,
        processing_delay_seconds=95,
        collector_degraded=False,
        sequence_gaps=0,
    )["state"] == "processing_delayed"

    assert delivery_health(
        now=now,
        last_accepted_at=now - timedelta(seconds=181),
        queue_delay_seconds=0,
        processing_delay_seconds=0,
        collector_degraded=False,
        sequence_gaps=0,
    )["state"] == "silent"


def test_delivery_health_prioritizes_data_loss_risk():
    now = datetime.now(timezone.utc)
    result = delivery_health(
        now=now,
        last_accepted_at=now - timedelta(seconds=20),
        queue_delay_seconds=0,
        processing_delay_seconds=0,
        collector_degraded=False,
        sequence_gaps=2,
    )

    assert result["state"] == "data_loss_risk"
