import type { NotificationAck, NotificationChannel, NotificationCoverageModule, NotificationLogEntry } from "./types";
import type { HealthCard } from "./overview";

const n = (value: number) => value.toLocaleString("en-US");
const DAY_MS = 24 * 3600 * 1000;

/** Log entries with `status` in the window ending at `now`. */
export function countSince(entries: Pick<NotificationLogEntry, "status" | "ts">[], status: string, windowMs: number, now: number): number {
  const cutoff = now - windowMs;
  return entries.filter((e) => e.status === status && new Date(e.ts).getTime() >= cutoff).length;
}

/** Enabled channels whose last delivery did not succeed. A channel never used is not broken. */
export function brokenChannels(channels: Pick<NotificationChannel, "enabled" | "last_status">[]): number {
  return channels.filter((c) => c.enabled && c.last_status && c.last_status !== "ok").length;
}

export function coverageTotals(coverage: Pick<NotificationCoverageModule, "event_count" | "gap_count" | "content_gap_count" | "counts">[]) {
  const sum = (pick: (m: (typeof coverage)[number]) => number) => coverage.reduce((total, m) => total + pick(m), 0);
  return {
    events: sum((m) => m.event_count),
    configured: sum((m) => m.counts.configured),
    fallback: sum((m) => m.counts.fallback),
    muted: sum((m) => m.counts.muted),
    unconfigured: sum((m) => m.counts.unconfigured),
    gaps: sum((m) => m.gap_count),
    contentGaps: sum((m) => m.content_gap_count),
  };
}

/** Groups routes by module in first-seen order; routes without a module go to a custom bucket. */
export function groupRoutes<T extends { module?: string | null }>(routes: T[]): { key: string; label: string; routes: T[] }[] {
  const groups: { key: string; label: string; routes: T[] }[] = [];
  const seen = new Map<string, number>();
  for (const route of routes) {
    const key = route.module || "__custom__";
    let index = seen.get(key);
    if (index === undefined) {
      index = groups.length;
      seen.set(key, index);
      groups.push({ key, label: key === "__custom__" ? "Custom / advanced" : key, routes: [] });
    }
    groups[index].routes.push(route);
  }
  return groups;
}

export function buildNotificationCards(input: {
  channels: Pick<NotificationChannel, "enabled" | "last_status">[];
  log: Pick<NotificationLogEntry, "status" | "ts">[];
  acks: Pick<NotificationAck, "fingerprint">[];
  coverage: Pick<NotificationCoverageModule, "event_count" | "gap_count" | "content_gap_count" | "counts">[];
  now: number;
}): HealthCard[] {
  const failed = countSince(input.log, "failed", DAY_MS, input.now);
  const sent = countSince(input.log, "sent", DAY_MS, input.now);
  const broken = brokenChannels(input.channels);
  const totals = coverageTotals(input.coverage);
  const paused = input.acks.length;
  return [
    {
      id: "failed",
      label: "Failed deliveries",
      value: n(failed),
      of: `of ${n(failed + sent)} in 24h`,
      tone: failed > 0 ? "critical" : "ok",
      ratio: failed + sent > 0 ? failed / (failed + sent) : null,
      detail: failed > 0 ? "Alerts that fired but did not arrive." : "Every alert in the last 24h was delivered.",
      href: "/notifications/log?status=failed",
      cta: "Show failures",
    },
    {
      id: "channels",
      label: "Channels failing",
      value: n(broken),
      of: `of ${n(input.channels.length)}`,
      tone: broken > 0 ? "critical" : input.channels.length === 0 ? "high" : "ok",
      ratio: input.channels.length > 0 ? broken / input.channels.length : null,
      detail: input.channels.length === 0 ? "No channel yet. Alerts have nowhere to go." : broken > 0 ? "The last send to these channels failed." : "Last send succeeded everywhere.",
      href: "#channels",
      cta: "Show channels",
    },
    {
      id: "gaps",
      label: "High and critical gaps",
      value: n(totals.gaps),
      of: `of ${n(totals.events)} event kinds`,
      tone: totals.gaps > 0 ? "high" : "ok",
      ratio: totals.events > 0 ? totals.gaps / totals.events : null,
      detail: totals.gaps > 0 ? "Serious events that would reach nobody." : "Every serious event has a route.",
      href: "#coverage",
      cta: "Show coverage",
    },
    {
      id: "paused",
      label: "Paused by ack",
      value: n(paused),
      tone: paused > 0 ? "medium" : "ok",
      ratio: null,
      detail: paused > 0 ? "Acknowledged alerts are muted until they expire." : "Nothing is paused.",
      href: paused > 0 ? "#paused" : "#routes",
      cta: paused > 0 ? "Show acks" : "Show routes",
    },
  ];
}
