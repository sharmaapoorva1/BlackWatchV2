import type { ProbeAgent, ServiceCounts, ServiceTarget } from "./types";
import { sumServiceCounts, type HealthCard, type Tone } from "./overview";

export const SERVICE_STATUS_FILTERS = ["up", "down", "degraded", "unknown", "disabled"] as const;
export type ServiceStatusFilter = (typeof SERVICE_STATUS_FILTERS)[number];

/** The `?status=` value if it is a known status. */
export function parseStatusFilter(value: string | undefined): ServiceStatusFilter | "" {
  return SERVICE_STATUS_FILTERS.includes(value as ServiceStatusFilter) ? (value as ServiceStatusFilter) : "";
}

/** Keep only services with `status`, dropping VPCs left empty. No filter keeps all. */
export function filterGrouped(
  grouped: Record<string, ServiceTarget[]>,
  status: ServiceStatusFilter | "",
): Record<string, ServiceTarget[]> {
  if (!status) return grouped;
  const out: Record<string, ServiceTarget[]> = {};
  for (const [vpc, services] of Object.entries(grouped)) {
    const kept = services.filter((service) => service.status === status);
    if (kept.length > 0) out[vpc] = kept;
  }
  return out;
}

const PROBLEM_RANK: Record<string, number> = { down: 0, degraded: 1, unknown: 2 };

/**
 * Live services that are down, degraded or unknown, worst first, and among
 * equals the ones down the longest. This is the triage list.
 */
export function needsAttention(grouped: Record<string, ServiceTarget[]>): ServiceTarget[] {
  const since = (service: ServiceTarget) => (service.down_since ? Date.parse(service.down_since) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER);
  return Object.values(grouped)
    .flat()
    .filter((service) => service.status in PROBLEM_RANK)
    .sort((a, b) => PROBLEM_RANK[a.status] - PROBLEM_RANK[b.status] || since(a) - since(b) || a.name.localeCompare(b.name));
}

/** "3 up · 1 down · 1 unknown", only the parts that are non-zero. */
export function vpcSummary(counts: ServiceCounts | undefined): string {
  if (!counts) return "";
  return [
    counts.up > 0 ? `${counts.up} up` : null,
    counts.down > 0 ? `${counts.down} down` : null,
    counts.degraded > 0 ? `${counts.degraded} degraded` : null,
    counts.unknown > 0 ? `${counts.unknown} unknown` : null,
    counts.disabled > 0 ? `${counts.disabled} disabled` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A VPC with any problem starts open; healthy ones collapse when there are many. */
export function vpcStartsOpen(counts: ServiceCounts | undefined, vpcCount: number): boolean {
  if (!counts) return true;
  return counts.down + counts.degraded + counts.unknown > 0 || vpcCount <= 3;
}

export function buildServiceCards(counts: Record<string, ServiceCounts>, agents: ProbeAgent[]): HealthCard[] {
  const total = sumServiceCounts(counts);
  const live = total.total - total.disabled;
  const none = live <= 0;

  const up: HealthCard = {
    id: "up",
    label: "Up",
    value: String(total.up),
    of: none ? undefined : `of ${live}`,
    tone: none ? "neutral" : total.up === live ? "ok" : "neutral",
    ratio: none ? null : total.up / live,
    detail: none ? "No probe targets configured." : total.up === live ? "Every probed service is up." : "Responding to probes.",
    href: "/services?status=up#services",
    cta: "Show services that are up",
  };
  const down: HealthCard = {
    id: "down",
    label: "Down",
    value: String(total.down),
    tone: total.down > 0 ? "critical" : "ok",
    ratio: null,
    detail: total.down === 0 ? "Nothing is down." : "Not responding to probes.",
    href: "/services?status=down#services",
    cta: "Show what is down",
  };
  const unsure = total.degraded + total.unknown;
  const watch: HealthCard = {
    id: "watch",
    label: "Degraded or unknown",
    value: String(unsure),
    tone: unsure > 0 ? "medium" : "ok",
    ratio: null,
    detail:
      unsure === 0
        ? "Nothing to watch."
        : [total.degraded > 0 ? `${total.degraded} degraded` : null, total.unknown > 0 ? `${total.unknown} cannot be probed` : null]
            .filter(Boolean)
            .join(", ") + ".",
    href: total.degraded > 0 ? "/services?status=degraded#services" : "/services?status=unknown#services",
    cta: "Show these services",
  };
  const reporting = agents.filter((agent) => agent.active === true).length;
  const agentTone: Tone = agents.length === 0 ? "neutral" : reporting === agents.length ? "ok" : reporting === 0 ? "critical" : "medium";
  const probes: HealthCard = {
    id: "agents",
    label: "Probe agents",
    value: String(reporting),
    of: agents.length === 0 ? undefined : `of ${agents.length}`,
    tone: agentTone,
    ratio: agents.length === 0 ? null : reporting / agents.length,
    detail:
      agents.length === 0
        ? "No probe agent has reported yet."
        : reporting === agents.length
          ? "Every VPC's agent is reporting."
          : `${agents.length - reporting} not reporting; those VPCs' results are stale.`,
    href: "#agents",
    cta: "See agents",
  };
  return [up, down, watch, probes];
}
