"""Runtime configuration, read from environment. Kept deliberately small."""

from __future__ import annotations

import os
from pathlib import Path

from .agents.ingress import parse_agent_tokens


def _parse_token_map(raw: str) -> dict[str, str]:
    """Parse "token1:module1,token2:module2" -> {token1: module1, ...}.

    The token a source presents determines which logical module its events are
    stamped with. If no dedicated adapter is registered for that module, the
    generic passthrough adapter handles it (see modules/registry.py)."""
    mapping: dict[str, str] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part or ":" not in part:
            continue
        token, module = part.split(":", 1)
        token, module = token.strip(), module.strip()
        if token and module:
            mapping[token] = module
    return mapping


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.environ.get(
            "DATABASE_URL",
            "postgresql://blackwatch:blackwatch@localhost:5432/blackwatch",
        )
        self.token_module_map: dict[str, str] = _parse_token_map(
            os.environ.get("BLACKWATCH_TOKENS", "devtoken:generic")
        )
        self.default_account: str | None = os.environ.get("BLACKWATCH_ACCOUNT") or None
        self.rules_dir: str = os.environ.get("RULES_DIR", "rules")
        self.notifications_file: str = os.environ.get(
            "NOTIFICATIONS_FILE", "notifications.yaml"
        )
        self.agent_tokens: dict[str, str] = parse_agent_tokens(
            os.environ.get("BLACKWATCH_AGENT_TOKENS", "")
        )
        self.agent_ingress_dir: Path = Path(
            os.environ.get("BLACKWATCH_AGENT_INGRESS_DIR", "/app/data/agent-ingress")
        )
        self.agent_ingress_max_files: int = int(
            os.environ.get("BLACKWATCH_AGENT_INGRESS_MAX_FILES", "10000")
        )
        self.agent_ingress_max_bytes: int = int(
            os.environ.get("BLACKWATCH_AGENT_INGRESS_MAX_BYTES", str(1024 * 1024 * 1024))
        )
        self.agent_ingress_max_request_bytes: int = int(
            os.environ.get("BLACKWATCH_AGENT_INGRESS_MAX_REQUEST_BYTES", str(1024 * 1024))
        )
        self.agent_ingress_lease_seconds: int = int(
            os.environ.get("BLACKWATCH_AGENT_INGRESS_LEASE_SECONDS", "300")
        )


settings = Settings()
