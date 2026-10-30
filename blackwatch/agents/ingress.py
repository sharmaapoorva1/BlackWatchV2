"""Validation and authentication for direct EC2 agent ingress."""

from __future__ import annotations

import gzip
import json
import secrets
from datetime import datetime
from typing import Any


class IngressAuthError(ValueError):
    pass


class IngressValidationError(ValueError):
    pass


def parse_agent_tokens(raw: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for part in (raw or "").split(","):
        part = part.strip()
        if not part or ":" not in part:
            continue
        agent_id, token = part.split(":", 1)
        agent_id, token = agent_id.strip(), token.strip()
        if agent_id and token:
            mapping[agent_id] = token
    return mapping


def authenticate_agent(authorization: str | None, tokens: dict[str, str]) -> str:
    if not isinstance(authorization, str) or not authorization.startswith("Bearer "):
        raise IngressAuthError("missing bearer token")
    presented = authorization[7:].strip()
    if not presented:
        raise IngressAuthError("missing bearer token")
    for agent_id, expected in tokens.items():
        if secrets.compare_digest(presented, expected):
            return agent_id
    raise IngressAuthError("invalid bearer token")


def decode_report_body(body: bytes, content_encoding: str | None, max_bytes: int) -> dict[str, Any]:
    if len(body) > max_bytes:
        raise IngressValidationError("report body exceeds configured size")
    if (content_encoding or "").lower().strip() == "gzip":
        try:
            body = gzip.decompress(body)
        except (OSError, EOFError) as exc:
            raise IngressValidationError("invalid gzip report") from exc
        if len(body) > max_bytes:
            raise IngressValidationError("decompressed report exceeds configured size")
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise IngressValidationError("report must be valid JSON") from exc
    if not isinstance(payload, dict):
        raise IngressValidationError("report must be a JSON object")
    return payload


def validate_report(payload: object, authenticated_agent_id: str, max_bytes: int) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise IngressValidationError("report must be a JSON object")
    try:
        encoded_size = len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise IngressValidationError("report contains unsupported values") from exc
    if encoded_size > max_bytes:
        raise IngressValidationError("report exceeds configured size")
    required_strings = ("agent_id", "report_id", "boot_id", "collected_at")
    for key in required_strings:
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            raise IngressValidationError("report is missing " + key)
    if payload["agent_id"] != authenticated_agent_id:
        raise IngressValidationError("report agent identity does not match credential")
    schema_version = payload.get("report_schema_version", 1)
    if isinstance(schema_version, bool) or not isinstance(schema_version, int) or schema_version not in (1, 2):
        raise IngressValidationError("unsupported report schema version")
    try:
        collected_at = datetime.fromisoformat(payload["collected_at"].replace("Z", "+00:00"))
    except ValueError as exc:
        raise IngressValidationError("report collected_at must be an ISO-8601 timestamp") from exc
    if collected_at.tzinfo is None:
        raise IngressValidationError("report collected_at must include a timezone")
    if payload.get("sent_at") is not None:
        try:
            sent_at = datetime.fromisoformat(payload["sent_at"].replace("Z", "+00:00"))
        except (AttributeError, ValueError) as exc:
            raise IngressValidationError("report sent_at must be an ISO-8601 timestamp") from exc
        if sent_at.tzinfo is None:
            raise IngressValidationError("report sent_at must include a timezone")
    if schema_version >= 2:
        host = payload.get("host")
        if not isinstance(host, dict):
            raise IngressValidationError("version 2 report host must be an object")
        if host.get("instance_id") != authenticated_agent_id:
            raise IngressValidationError("version 2 report host identity does not match credential")
        if not isinstance(payload.get("collector_status"), dict):
            raise IngressValidationError("version 2 collector_status must be an object")
    host = payload.get("host")
    if isinstance(host, dict) and host.get("instance_id") not in (None, authenticated_agent_id):
        raise IngressValidationError("report host identity does not match credential")
    if schema_version >= 2:
        if "snapshots" in payload and not isinstance(payload["snapshots"], dict):
            raise IngressValidationError("version 2 snapshots must be an object")
    sequence = payload.get("sequence")
    if isinstance(sequence, bool) or not isinstance(sequence, int) or sequence < 0:
        raise IngressValidationError("report sequence must be a non-negative integer")
    return payload
