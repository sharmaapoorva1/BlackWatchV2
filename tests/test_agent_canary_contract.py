from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_installer_supports_direct_transport_without_exposing_token_in_unit():
    installer = (ROOT / "deploy" / "ec2" / "install-agent.sh").read_text(encoding="utf-8")
    assert "BLACKWATCH_TRANSPORT" in installer
    assert "BLACKWATCH_INGEST_URL" in installer
    assert "BLACKWATCH_AGENT_TOKEN" in installer
    assert "agent_transport.py" in installer
    assert "EnvironmentFile=-${ENV_FILE}" in installer
    assert "Environment=BLACKWATCH_AGENT_TOKEN" not in installer


def test_operator_docs_include_https_canary_and_sqs_rollback():
    docs = (ROOT / "docs" / "ec2-agent.md").read_text(encoding="utf-8")
    readme = (ROOT / "deploy" / "ec2" / "README.md").read_text(encoding="utf-8")
    for text in (docs, readme):
        assert "BLACKWATCH_TRANSPORT=https" in text
        assert "BLACKWATCH_INGEST_URL" in text
        assert "BLACKWATCH_AGENT_TOKEN" in text
        assert "BLACKWATCH_TRANSPORT=sqs" in text or "SQS" in text
