"""SQS-backed CloudTrail collection. Receives the events an EventBridge->Lambda
forwarder placed on the queue, runs each through the ingest pipeline, and
deletes only the ones that ingested successfully (failures redeliver / land in
the queue's DLQ). boto3 is imported lazily so the app runs without it until an
AWS connector is actually used."""

from __future__ import annotations

import json
import logging
from typing import Any, Callable


from .. import pipeline
from .models import AwsCloudtrailSqsConfig

_log = logging.getLogger(__name__)


def _client(cfg: AwsCloudtrailSqsConfig):
    import boto3  # lazy import
    from botocore.config import Config

    session = boto3.session.Session(region_name=cfg.aws_region)
    return session.client(
        "sqs",
        config=Config(
            connect_timeout=10,
            read_timeout=max(20, cfg.wait_seconds + 10),
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def test_connection(cfg: AwsCloudtrailSqsConfig) -> dict[str, Any]:
    """Bounded SQS connectivity/permission probe used by the Test action.

    A test must not consume the connector's workload.  In particular, it must
    not run the ingest pipeline or delete messages: those are collection
    responsibilities for a manual or scheduled operation.
    """
    import boto3  # lazy import
    from botocore.config import Config

    session = boto3.session.Session(region_name=cfg.aws_region)
    sqs = session.client(
        "sqs",
        config=Config(
            connect_timeout=5,
            read_timeout=5,
            retries={"max_attempts": 0, "mode": "standard"},
        ),
    )
    attributes = sqs.get_queue_attributes(
        QueueUrl=cfg.queue_url,
        AttributeNames=["QueueArn"],
    )
    # Validate receive permission without waiting for long polling and without
    # changing message visibility. The message is intentionally not deleted.
    response = sqs.receive_message(
        QueueUrl=cfg.queue_url,
        MaxNumberOfMessages=1,
        WaitTimeSeconds=0,
        VisibilityTimeout=0,
    )
    return {
        "messages": len(response.get("Messages", [])),
        "queue_attributes": len(attributes.get("Attributes", {})),
    }


def drain(
    cfg: AwsCloudtrailSqsConfig,
    *,
    progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    sqs = _client(cfg)
    total_messages = 0
    total_ingested = 0
    total_failed = 0
    total_deleted = 0

    for batch in range(1, max(1, cfg.max_batches) + 1):
        if progress:
            progress({"stage": "receiving", "batch": batch, "fetched": total_messages,
                      "ingested": total_ingested, "failed": total_failed,
                      "deleted": total_deleted})
        resp = sqs.receive_message(
            QueueUrl=cfg.queue_url,
            MaxNumberOfMessages=10,
            WaitTimeSeconds=cfg.wait_seconds,
        )
        messages = resp.get("Messages", [])
        if progress:
            progress({"stage": "received", "batch": batch, "fetched": total_messages + len(messages),
                      "batch_messages": len(messages), "ingested": total_ingested,
                      "failed": total_failed, "deleted": total_deleted})
        if not messages:
            break

        to_delete = []
        for message in messages:
            total_messages += 1
            try:
                body = json.loads(message["Body"])
            except (ValueError, KeyError):
                body = {"raw": message.get("Body")}
            detail = body.get("detail") if isinstance(body, dict) and isinstance(body.get("detail"), dict) else body
            action = (detail.get("eventName") or detail.get("action")) if isinstance(detail, dict) else None
            if progress:
                progress({"stage": "ingesting", "batch": batch, "message_index": total_messages,
                          "message_id": message.get("MessageId"), "fetched": total_messages,
                          "ingested": total_ingested, "failed": total_failed,
                          "deleted": total_deleted, "action": action})
            try:
                result = pipeline.ingest_payload(cfg.target_module, body, transport="queue")
                total_ingested += result.get("ingested", 0)
                to_delete.append(
                    {"Id": message["MessageId"], "ReceiptHandle": message["ReceiptHandle"]}
                )
                if progress:
                    progress({"stage": "ingested", "batch": batch, "message_index": total_messages,
                              "message_id": message.get("MessageId"), "fetched": total_messages,
                              "ingested": total_ingested, "failed": total_failed,
                              "deleted": total_deleted, "action": action})
            except Exception as exc:
                # leave the message on the queue for redelivery / DLQ — but
                # LOG the failure so silent-fail loops are visible. Includes
                # the action/eventName so you can tell what kind of payload
                # the adapter is choking on.
                hint = ""
                if isinstance(body, dict):
                    detail = body.get("detail") if isinstance(body.get("detail"), dict) else body
                    hint = f" action={detail.get('eventName') or detail.get('action') or '?'}"
                _log.exception(
                    "sqs.ingest_failed module=%s message_id=%s%s: %s",
                    cfg.target_module, message.get("MessageId"), hint, exc,
                )
                total_failed += 1
                if progress:
                    progress({"stage": "failed", "batch": batch, "message_index": total_messages,
                              "message_id": message.get("MessageId"), "fetched": total_messages,
                              "ingested": total_ingested, "failed": total_failed,
                              "deleted": total_deleted, "action": action})
                continue

        if to_delete:
            if progress:
                progress({"stage": "deleting", "batch": batch, "fetched": total_messages,
                          "ingested": total_ingested, "failed": total_failed,
                          "deleted": total_deleted, "deleting": len(to_delete)})
            sqs.delete_message_batch(QueueUrl=cfg.queue_url, Entries=to_delete)
            total_deleted += len(to_delete)
            if progress:
                progress({"stage": "batch_complete", "batch": batch, "fetched": total_messages,
                          "ingested": total_ingested, "failed": total_failed,
                          "deleted": total_deleted, "batch_deleted": len(to_delete)})

    return {"ingested": total_ingested, "messages": total_messages}
