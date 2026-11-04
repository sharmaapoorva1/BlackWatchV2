import type { Connector } from "./types";

// Slim, serializable connector rows. `config` is deliberately NOT shipped to
// the browser: it can hold queue URLs, role names and bucket names. The
// "details" cell is composed on the server from the few non-sensitive fields
// it needs.

export type ConnectorPillSeverity = "resolved" | "critical" | "medium" | "neutral";

export interface ConnectorTableRow {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  verified: boolean;
  details: string;
  interval_seconds: string;
  last_run_at: string | null;
  status: { severity: ConnectorPillSeverity; label: string };
  /** Multi-line-safe error text shown under the status, if any. */
  error: string | null;
}

/** Type-specific one-line description of what the connector polls. */
export function connectorDetails(connector: Pick<Connector, "type" | "config">): string {
  const cfg = (connector.config ?? {}) as Record<string, unknown>;
  switch (connector.type) {
    case "aws_cloudtrail_sqs":
      return `${String(cfg.aws_region ?? "—")} · ${String(cfg.target_module ?? "aws.cloudtrail")}`;
    case "aws_ecs_health":
      return `${String(cfg.aws_region ?? "—")} · vpc=${String(cfg.vpc ?? "—")}`;
    case "aws_s3_drift":
      return "all regions · instance role credentials";
    case "aws_s3_access_logs":
      return `bucket=${String(cfg.bucket ?? "—")} · prefix=${String(cfg.prefix ?? "(all)")}`;
    case "aws_posture_drift": {
      const regions = (cfg.regions as string[] | undefined) ?? [];
      return `${regions.length > 0 ? regions.join(",") : "all regions"} · instance role credentials`;
    }
    case "cert_probe": {
      const targets = (cfg.targets as unknown[] | undefined) ?? [];
      return `${targets.length} target${targets.length === 1 ? "" : "s"} · every ${String(cfg.interval_seconds ?? 3600)}s`;
    }
    default:
      return "—";
  }
}

/** Operator-facing state for the status pill. */
export function connectorStatus(
  connector: Pick<Connector, "latest_operation" | "health_state" | "last_status">,
): { severity: ConnectorPillSeverity; label: string } {
  const operation = connector.latest_operation;
  if (operation?.status === "queued" || operation?.status === "running") {
    return { severity: "neutral", label: operation.status };
  }
  const state = connector.health_state ?? connector.last_status;
  if (state === "healthy" || state === "ok") return { severity: "resolved", label: "healthy" };
  if (state === "failing" || state === "error" || operation?.status === "failed" || operation?.status === "timed_out") {
    return { severity: "critical", label: operation?.status === "timed_out" ? "timed out" : "failing" };
  }
  if (state === "stale") return { severity: "medium", label: "stale" };
  if (state === "disabled") return { severity: "neutral", label: "disabled" };
  if (state === "unverified") return { severity: "neutral", label: "unverified" };
  return { severity: "neutral", label: "never run" };
}

function errorText(connector: Pick<Connector, "last_error" | "latest_operation">): string | null {
  const operation = connector.latest_operation;
  const message = operation?.error_message ?? connector.last_error;
  if (!message) return null;
  const prefix = operation?.error_category ? `${operation.error_category}: ` : "last error: ";
  const ref = operation?.correlation_id ? ` · ref ${operation.correlation_id.slice(0, 8)}` : "";
  return `${prefix}${message}${ref}`;
}

export function toConnectorRow(connector: Connector): ConnectorTableRow {
  const interval = (connector.config as { interval_seconds?: number } | undefined)?.interval_seconds;
  return {
    id: connector.id,
    name: connector.name,
    type: connector.type,
    enabled: connector.enabled,
    verified: connector.verified,
    details: connectorDetails(connector),
    interval_seconds: String(interval ?? "—"),
    last_run_at: connector.last_run_at,
    status: connectorStatus(connector),
    error: errorText(connector),
  };
}
