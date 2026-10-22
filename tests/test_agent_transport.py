from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from scripts.agent_transport import (
    HttpsTransport,
    LocalSpool,
    SendResult,
    SqsTransport,
    priority_for_report,
)


class FakeResponse:
    def __init__(self, status: int, body: bytes = b"{}", headers: dict | None = None):
        self.status = status
        self._body = body
        self.headers = headers or {}

    def read(self) -> bytes:
        return self._body

    def close(self) -> None:
        return None


class FakeConnection:
    def __init__(self, response: FakeResponse):
        self.response = response
        self.requests: list[tuple] = []

    def request(self, method, path, body, headers):
        self.requests.append((method, path, body, headers))

    def getresponse(self):
        return self.response

    def close(self):
        return None


def test_priority_marks_reports_with_critical_findings_first():
    assert priority_for_report({"priority_counts": {"critical": 1}}) == "critical"
    assert priority_for_report({"priority_counts": {"critical": 0}}) == "bulk"


def test_sqs_transport_returns_ack(monkeypatch):
    calls = []

    class Client:
        def send_message(self, **kwargs):
            calls.append(kwargs)
            return {"MessageId": "sqs-1"}

    transport = SqsTransport("https://sqs.us-west-1.amazonaws.com/123/q", client=Client())
    result = transport.send(b'{"report_id":"r1"}', priority="critical")

    assert isinstance(result, SendResult)
    assert result.accepted is True
    assert result.ack_id == "sqs-1"
    assert json.loads(calls[0]["MessageBody"])["report_id"] == "r1"


def test_https_transport_accepts_and_reuses_connection():
    connection = FakeConnection(
        FakeResponse(202, b'{"ack_id":"ack-1","accepted_at":"2026-10-21T12:00:00+00:00"}')
    )
    transport = HttpsTransport(
        "https://blackwatch.example/api/agent/v1/reports",
        "agent-token",
        connection_factory=lambda host, port, timeout: connection,
    )

    result = transport.send(b'{"report_id":"r1"}', priority="critical")
    second = transport.send(b'{"report_id":"r2"}', priority="critical")

    assert result.accepted is True
    assert result.ack_id == "ack-1"
    assert second.accepted is True
    assert len(connection.requests) == 2
    assert connection.requests[0][0:2] == ("POST", "/api/agent/v1/reports")
    assert connection.requests[0][3]["Authorization"] == "Bearer agent-token"


def test_https_transport_passes_explicit_port_and_timeout_to_connection_factory():
    connection = FakeConnection(FakeResponse(202, b'{"ack_id":"ack-9443"}'))
    calls = []

    def factory(host, port, timeout):
        calls.append((host, port, timeout))
        return connection

    transport = HttpsTransport(
        "https://blackwatch.example:9443/api/agent/v1/reports",
        "agent-token",
        connection_factory=factory,
    )

    result = transport.send(b'{"report_id":"r-9443"}', priority="critical")

    assert result.accepted is True
    assert calls == [("blackwatch.example", 9443, 5.0)]


def test_https_transport_preserves_retry_after_for_backpressure():
    connection = FakeConnection(FakeResponse(503, b"busy", {"Retry-After": "7"}))
    transport = HttpsTransport(
        "https://blackwatch.example/api/agent/v1/reports",
        "agent-token",
        connection_factory=lambda host, port, timeout: connection,
    )

    result = transport.send(b"{}", priority="bulk")

    assert result.accepted is False
    assert result.retry_after == 7
    assert result.error_category == "backpressure"


def test_local_spool_drains_critical_before_bulk():
    root = Path("tests") / (".agent-transport-" + uuid.uuid4().hex)
    try:
        spool = LocalSpool(root)
        spool.enqueue({"report_id": "bulk-1", "priority_counts": {"critical": 0}})
        spool.enqueue({"report_id": "critical-1", "priority_counts": {"critical": 1}})

        pending = list(spool.pending())

        assert [row.payload["report_id"] for row in pending] == ["critical-1", "bulk-1"]
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_local_spool_caps_drop_bulk_before_critical():
    root = Path("tests") / (".agent-transport-cap-" + uuid.uuid4().hex)
    try:
        spool = LocalSpool(root, max_files=1)
        spool.enqueue({"report_id": "bulk-1", "priority_counts": {"critical": 0}})
        spool.enqueue({"report_id": "critical-1", "priority_counts": {"critical": 1}})
        assert [row.payload["report_id"] for row in spool.pending()] == ["critical-1"]
    finally:
        shutil.rmtree(root, ignore_errors=True)
