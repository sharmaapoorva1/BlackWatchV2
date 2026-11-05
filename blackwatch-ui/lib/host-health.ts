import type { AgentIngressDiagnostics, HostSummary } from "./types";
import { ingestionCard, type HealthCard, type Tone } from "./overview";

export type FleetGroup = "healthy" | "attention" | "silent";

export const FLEET_GROUPS: FleetGroup[] = ["healthy", "attention", "silent"];

/** The agent's own health state, falling back to staleness. */
export function hostState(host: Pick<HostSummary, "health_state" | "stale" | "active">): string {
  const reported = host.health_state ?? (host.stale || !host.active ? "silent" : "healthy");
  return host.stale && reported === "healthy" ? "silent" : reported;
}

/** Healthy, needs attention (degraded or delayed but reporting), or silent. */
export function hostGroup(host: Pick<HostSummary, "health_state" | "stale" | "active">): FleetGroup {
  const state = hostState(host);
  if (state === "healthy") return "healthy";
  if (state === "silent" || !host.active || host.stale) return "silent";
  return "attention";
}

export function fleetCounts(hosts: HostSummary[]): Record<FleetGroup, number> {
  const counts: Record<FleetGroup, number> = { healthy: 0, attention: 0, silent: 0 };
  for (const host of hosts) counts[hostGroup(host)] += 1;
  return counts;
}

/** "2 delivery delayed, 1 collector degraded": why hosts are in the attention group. */
export function attentionReasons(hosts: HostSummary[]): string {
  const byState = new Map<string, number>();
  for (const host of hosts) {
    if (hostGroup(host) !== "attention") continue;
    const state = hostState(host).replaceAll("_", " ");
    byState.set(state, (byState.get(state) ?? 0) + 1);
  }
  return [...byState.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => `${count} ${state}`)
    .join(", ");
}

/** The `?health=` value if it is one of the three groups. */
export function parseFleetGroup(value: string | undefined): FleetGroup | "" {
  return FLEET_GROUPS.includes(value as FleetGroup) ? (value as FleetGroup) : "";
}

/** Host counts per environment tag, biggest first; hosts without one are "untagged". */
export function environmentCounts(hosts: HostSummary[]): { env: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const host of hosts) {
    const env = host.tags?.env || "untagged";
    counts.set(env, (counts.get(env) ?? 0) + 1);
  }
  return [...counts.entries()].map(([env, count]) => ({ env, count })).sort((a, b) => b.count - a.count || a.env.localeCompare(b.env));
}

/**
 * The fleet's headline cards. Each one filters the fleet table below it (the
 * links carry `?health=` and land on `#fleet`), so a number is always one click
 * from the hosts behind it.
 */
export function buildFleetCards(hosts: HostSummary[], ingress: Pick<AgentIngressDiagnostics, "metrics"> | null): HealthCard[] {
  const total = hosts.length;
  const counts = fleetCounts(hosts);
  const none = total === 0;

  const healthy: HealthCard = {
    id: "healthy",
    label: "Healthy",
    value: String(counts.healthy),
    of: none ? undefined : `of ${total}`,
    tone: none ? "neutral" : counts.attention + counts.silent === 0 ? "ok" : "neutral",
    ratio: none ? null : counts.healthy / total,
    detail: none ? "No hosts have reported yet." : counts.healthy === total ? "Every host is reporting normally." : "Reporting normally.",
    href: "/hosts?health=healthy#fleet",
    cta: "Show healthy hosts",
  };

  const attentionTone: Tone = counts.attention > 0 ? "medium" : "ok";
  const attention: HealthCard = {
    id: "attention",
    label: "Needs attention",
    value: String(counts.attention),
    tone: attentionTone,
    ratio: null,
    detail: counts.attention === 0 ? "No degraded or delayed agents." : `${attentionReasons(hosts)}.`,
    href: "/hosts?health=attention#fleet",
    cta: "Show these hosts",
  };

  const silent: HealthCard = {
    id: "silent",
    label: "Silent",
    value: String(counts.silent),
    tone: counts.silent > 0 ? "critical" : "ok",
    ratio: null,
    detail: counts.silent === 0 ? "No host has gone quiet." : "Not reporting. Check the agent and its network path.",
    href: "/hosts?health=silent#fleet",
    cta: "Show silent hosts",
  };

  return [healthy, attention, silent, ingestionCard(ingress)];
}
