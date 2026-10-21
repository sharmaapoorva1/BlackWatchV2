from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from blackwatch.agents.spool import IngressSpool
from blackwatch.services.agent_ingest_worker import run_once


def payload(report_id: str = "r-1") -> dict:
    return {
        "kind": "ec2_report",
        "agent_id": "i-123",
        "report_id": report_id,
        "boot_id": "boot-1",
        "sequence": 1,
        "collected_at": "2026-10-21T12:00:00+00:00",
        "priority_counts": {"critical": 0},
        "host": {"instance_id": "i-123"},
    }


class FakeStorage:
    def __init__(self, claim_result: bool = True):
        self.claim_result = claim_result
        self.calls = []

    def claim_agent_report(self, agent_id, report_id, lease_seconds):
        self.calls.append(("claim", agent_id, report_id, lease_seconds))
        return self.claim_result

    def complete_agent_report(self, agent_id, report_id, processed_at, stats):
        self.calls.append(("complete", agent_id, report_id, stats))

    def retry_agent_report(self, agent_id, report_id, error, retry_at):
        self.calls.append(("retry", agent_id, report_id, error, retry_at))

    def quarantine_agent_report(self, agent_id, report_id, reason):
        self.calls.append(("quarantine", agent_id, report_id, reason))


class FakePipeline:
    def __init__(self, error=None):
        self.error = error
        self.calls = []

    def ingest_payload(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        if self.error:
            raise self.error
        return {"ingested": 1, "events": 1}


def make_spool():
    root = Path("tests") / (".agent-worker-" + uuid.uuid4().hex)
    return root, IngressSpool(root, max_files=10, max_bytes=10_000)


def test_worker_processes_and_completes_one_report():
    root, spool = make_spool()
    try:
        spool.persist("i-123", "r-1", payload(), "bulk")
        storage = FakeStorage()
        pipeline = FakePipeline()
        result = run_once(
            spool,
            now=datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc),
            storage_module=storage,
            pipeline_module=pipeline,
        )
        assert result.state == "completed"
        assert pipeline.calls[0][0][0] == "ec2.host"
        assert any(call[0] == "complete" for call in storage.calls)
        assert spool.stats()["files"]["processing"] == 0
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_worker_acknowledges_duplicate_without_pipeline_processing():
    root, spool = make_spool()
    try:
        spool.persist("i-123", "r-1", payload(), "bulk")
        storage = FakeStorage(claim_result=False)
        pipeline = FakePipeline()
        result = run_once(spool, storage_module=storage, pipeline_module=pipeline)
        assert result.state == "duplicate"
        assert pipeline.calls == []
        assert spool.stats()["files"]["processing"] == 0
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_worker_retries_pipeline_failure_and_preserves_report():
    root, spool = make_spool()
    try:
        spool.persist("i-123", "r-1", payload(), "bulk")
        storage = FakeStorage()
        pipeline = FakePipeline(RuntimeError("database unavailable"))
        result = run_once(
            spool,
            now=datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc),
            storage_module=storage,
            pipeline_module=pipeline,
        )
        assert result.state == "retry"
        assert spool.stats()["files"]["retry"] == 1
        assert any(call[0] == "retry" for call in storage.calls)
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_worker_quarantines_invalid_report():
    root, spool = make_spool()
    try:
        spool.persist("i-123", "r-1", {"agent_id": "i-123"}, "bulk")
        storage = FakeStorage()
        pipeline = FakePipeline()
        result = run_once(spool, storage_module=storage, pipeline_module=pipeline)
        assert result.state == "quarantine"
        assert spool.stats()["files"]["quarantine"] == 1
        assert any(call[0] == "quarantine" for call in storage.calls)
    finally:
        shutil.rmtree(root, ignore_errors=True)
