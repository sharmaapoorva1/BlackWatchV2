import type {
  AgentIngressDiagnostics,
  ConnectorsListResponse,
  OverviewResponse,
} from "./types";

export type AttentionLevel = "critical" | "high" | "medium";

export interface AttentionItem {
  id: string;
  level: AttentionLevel;
  title: string;
  detail: string;
  href: string;
}

export interface AttentionInput {
  overview?: Pick<OverviewResponse, "hosts" | "posture" | "notable"> | null;
  connectors?: Pick<ConnectorsListResponse, "connectors"> | null;
  ingress?: Pick<AgentIngressDiagnostics, "metrics"> | null;
}

const LEVEL_WEIGHT: Record<AttentionLevel, number> = { critical: 0, high: 1, medium: 2 };

// Items about the platform itself (collection and delivery), as opposed to
// detections. The top-bar health indicator shows only these: a standing list of
// recent high events would keep it permanently red.
const SYSTEM_ITEM_IDS = new Set([
  "hosts-stale",
  "connectors-failing",
  "connectors-stale",
  "ingest-quarantined",
  "ingest-retrying",
]);

export function isSystemItem(item: AttentionItem): boolean {
  return SYSTEM_ITEM_IDS.has(item.id);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Turns the signals an operator must act on into one ranked list. Pure so the
 * Overview page (server) and the top-bar health indicator (client) share the
 * exact same definition of "needs attention".
 */
export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { overview, connectors, ingress } = input;

  if (overview) {
    const bySeverity = overview.posture.by_severity;
    if (bySeverity.critical > 0) {
      items.push({
        id: "posture-critical",
        level: "critical",
        title: `${plural(bySeverity.critical, "critical posture finding")} open`,
        detail: "AWS configuration that exposes data or weakens a control.",
        href: "/aws-posture",
      });
    }
    if (bySeverity.high > 0) {
      items.push({
        id: "posture-high",
        level: "high",
        title: `${plural(bySeverity.high, "high posture finding")} open`,
        detail: "Review and remediate or accept the risk.",
        href: "/aws-posture",
      });
    }
    if (overview.notable.length > 0) {
      items.push({
        id: "notable-events",
        level: "high",
        title: `${plural(overview.notable.length, "high or critical event")} in the recent window`,
        detail: "Triage the latest detections.",
        href: "/events?severity=high",
      });
    }
    if (overview.hosts.total > 0 && overview.hosts.stale > 0) {
      items.push({
        id: "hosts-stale",
        level: "medium",
        title: `${plural(overview.hosts.stale, "host")} not reporting`,
        detail: `${overview.hosts.reporting} of ${overview.hosts.total} hosts are sending telemetry.`,
        href: "/hosts",
      });
    }
  }

  if (connectors) {
    const enabled = connectors.connectors.filter((connector) => connector.enabled);
    const failing = enabled.filter((connector) => connector.health_state === "failing");
    const stale = enabled.filter((connector) => connector.health_state === "stale");
    if (failing.length > 0) {
      items.push({
        id: "connectors-failing",
        level: "high",
        title: `${plural(failing.length, "connector")} failing`,
        detail: `${failing.map((connector) => connector.name).slice(0, 3).join(", ")}${failing.length > 3 ? "…" : ""} — detections from these sources are delayed.`,
        href: "/connectors",
      });
    }
    if (stale.length > 0) {
      items.push({
        id: "connectors-stale",
        level: "medium",
        title: `${plural(stale.length, "connector")} not running on schedule`,
        detail: `${stale.map((connector) => connector.name).slice(0, 3).join(", ")}${stale.length > 3 ? "…" : ""}`,
        href: "/connectors",
      });
    }
  }

  const metrics = ingress?.metrics;
  if (metrics && metrics.available !== false) {
    if ((metrics.quarantined ?? 0) > 0) {
      items.push({
        id: "ingest-quarantined",
        level: "high",
        title: `${plural(metrics.quarantined ?? 0, "agent report")} quarantined`,
        detail: "Reports that failed processing and need inspection.",
        href: "/hosts",
      });
    }
    if ((metrics.retrying ?? 0) > 0) {
      items.push({
        id: "ingest-retrying",
        level: "medium",
        title: `${plural(metrics.retrying ?? 0, "agent report")} retrying`,
        detail: "Processing is behind; data may arrive late.",
        href: "/hosts",
      });
    }
  }

  return items.sort((a, b) => LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level]);
}
