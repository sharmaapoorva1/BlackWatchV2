import type { Connector } from "./types";
import type { HealthCard } from "./overview";

/** Three buckets an operator cares about. */
export type ConnectorGroup = "attention" | "healthy" | "disabled";

export const CONNECTOR_GROUPS: ConnectorGroup[] = ["attention", "healthy", "disabled"];

export const CONNECTOR_GROUP_LABEL: Record<ConnectorGroup, string> = {
  attention: "Needs attention",
  healthy: "Healthy",
  disabled: "Disabled",
};

type Stateful = Pick<Connector, "enabled" | "verified" | "last_status"> & { health_state?: string };

/** The server's `health_state` when present, else derived from the basic fields. */
export function connectorState(c: Stateful): string {
  if (c.health_state) return c.health_state;
  if (!c.enabled) return "disabled";
  if (!c.verified) return "unverified";
  if (c.last_status === "error") return "failing";
  if (c.last_status === "ok") return "healthy";
  return "never_run";
}

export function connectorGroup(c: Stateful): ConnectorGroup {
  const state = connectorState(c);
  if (state === "disabled") return "disabled";
  if (state === "healthy" || state === "running") return "healthy";
  return "attention";
}

export function parseConnectorGroup(value: string | undefined): ConnectorGroup | "" {
  return CONNECTOR_GROUPS.includes(value as ConnectorGroup) ? (value as ConnectorGroup) : "";
}

export function connectorCounts(connectors: Stateful[]): Record<ConnectorGroup, number> & { failing: number } {
  const counts = { attention: 0, healthy: 0, disabled: 0, failing: 0 };
  for (const c of connectors) {
    counts[connectorGroup(c)] += 1;
    if (connectorState(c) === "failing") counts.failing += 1;
  }
  return counts;
}

/** Connectors in `group` (all when empty); attention cases keep failing ones first. */
export function filterConnectors<T extends Stateful & { name: string }>(connectors: T[], group: ConnectorGroup | ""): T[] {
  const rank = (c: T) => (connectorState(c) === "failing" ? 0 : 1);
  return connectors
    .filter((c) => !group || connectorGroup(c) === group)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function buildConnectorCards(connectors: Stateful[]): HealthCard[] {
  const counts = connectorCounts(connectors);
  const total = connectors.length;
  const of = total > 0 ? `of ${total}` : undefined;
  return [
    {
      id: "attention",
      label: "Needs attention",
      value: String(counts.attention),
      of,
      tone: counts.failing > 0 ? "critical" : counts.attention > 0 ? "high" : "ok",
      ratio: total > 0 ? counts.attention / total : null,
      detail:
        counts.failing > 0
          ? `${counts.failing} failing. Their data is not arriving.`
          : counts.attention > 0
            ? "Unverified, stale or never run."
            : "Every enabled connector is healthy.",
      href: "/connectors?health=attention#connectors",
      cta: "Show these",
    },
    {
      id: "healthy",
      label: "Healthy",
      value: String(counts.healthy),
      of,
      tone: counts.healthy > 0 ? "ok" : "neutral",
      ratio: total > 0 ? counts.healthy / total : null,
      detail: "Last run succeeded.",
      href: "/connectors?health=healthy#connectors",
      cta: "Show healthy",
    },
    {
      id: "disabled",
      label: "Disabled",
      value: String(counts.disabled),
      of,
      tone: "neutral",
      ratio: null,
      detail: counts.disabled > 0 ? "Not polling." : "None switched off.",
      href: "/connectors?health=disabled#connectors",
      cta: "Show disabled",
    },
  ];
}
