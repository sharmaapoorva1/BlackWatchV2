from __future__ import annotations

import gzip
import json
import shutil
import uuid
from pathlib import Path

import pytest

from blackwatch.agents.ingress import (
    IngressAuthError,
    IngressValidationError,
    authenticate_agent,
    decode_report_body,
    parse_agent_tokens,
    validate_report,
)
from blackwatch.agents.spool import IngressSpool, SpoolCapacityError


def report(agent_id: str = "i-123", report_id: str = "r-1") -> dict:
    return {
        "agent_id": agent_id,
        "report_id": report_id,
        "boot_id": "boot-1",
        "sequence": 1,
        "collected_at": "2026-10-21T12:00:00+00:00",
        "priority_counts": {"critical": 0},
    }


def local_root() -> Path:
    return Path("tests") / (".agent-ingress-" + uuid.uuid4().hex)


def test_agent_token_map_and_identity_binding():
    tokens = parse_agent_tokens("i-123:secret-1,i-456:secret-2")
    assert tokens == {"i-123": "secret-1", "i-456": "secret-2"}
    assert authenticate_agent("Bearer secret-1", tokens) == "i-123"
    with pytest.raises(IngressAuthError):
        authenticate_agent("Bearer secret-unknown", tokens)


def test_validate_report_rejects_forged_identity_and_missing_metadata():
    with pytest.raises(IngressValidationError):
        validate_report(report(agent_id="i-forged"), "i-123", max_bytes=10_000)
    with pytest.raises(IngressValidationError):
        validate_report({"agent_id": "i-123"}, "i-123", max_bytes=10_000)


def test_decode_report_body_supports_gzip_and_enforces_limit():
    raw = json.dumps(report()).encode("utf-8")
    assert decode_report_body(gzip.compress(raw), "gzip", max_bytes=10_000)["report_id"] == "r-1"
    with pytest.raises(IngressValidationError):
        decode_report_body(raw, None, max_bytes=10)


def test_ingress_spool_persists_atomically_and_recognizes_duplicate():
    root = local_root()
    try:
        spool = IngressSpool(root, max_files=10, max_bytes=10_000)
        first = spool.persist("i-123", "r-1", report(), "bulk")
        duplicate = spool.persist("i-123", "r-1", report(), "bulk")
        assert first.accepted is True
        assert duplicate.duplicate is True
        assert list(root.rglob("*.tmp")) == []
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_ingress_spool_returns_capacity_error_without_partial_file():
    root = local_root()
    try:
        spool = IngressSpool(root, max_files=0, max_bytes=10_000)
        with pytest.raises(SpoolCapacityError):
            spool.persist("i-123", "r-1", report(), "critical")
        assert list(root.rglob("*.json")) == []
    finally:
        shutil.rmtree(root, ignore_errors=True)
