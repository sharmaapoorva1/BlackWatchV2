import type { HealthCard } from "./overview";
import type { AwsTimelineResponse, AwsTimelineUserResponse, EventEnvelope } from "./types";

export type AwsTimelineTab = "critical" | "high" | "all" | "users";

export const AWS_TIMELINE_TABS: { id: AwsTimelineTab; label: string }[] = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "all", label: "All" },
  { id: "users", label: "Users" },
];

export const AWS_TIMELINE_WINDOWS: { hours: number; label: string }[] = [
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
  { hours: 720, label: "30d" },
];

export function parseAwsTimelineTab(value: string | undefined): AwsTimelineTab {
  return AWS_TIMELINE_TABS.some((tab) => tab.id === value) ? (value as AwsTimelineTab) : "all";
}

/** Only the windows the page offers; anything else falls back. */
export function parseAwsTimelineHours(value: string | undefined, fallback: number): number {
  const hours = Number(value);
  return AWS_TIMELINE_WINDOWS.some((w) => w.hours === hours) ? hours : fallback;
}

const n = (value: number) => value.toLocaleString("en-US");

export function windowLabel(hours: number): string {
  return AWS_TIMELINE_WINDOWS.find((w) => w.hours === hours)?.label ?? `${hours}h`;
}

export function timelineHref(tab: AwsTimelineTab, hours: number): string {
  return `/aws-timeline?tab=${tab}&hours=${hours}#activity`;
}

export function userTimelineHref(principal: string, hours: number): string {
  return `/aws-timeline/user?principal=${encodeURIComponent(principal)}&hours=${hours}`;
}

/** Three cards, each saying the number, whether it is fine, and where to go next. */
export function buildAwsTimelineCards(data: Pick<AwsTimelineResponse, "counts" | "users" | "hours">): HealthCard[] {
  const { counts, users, hours } = data;
  const span = windowLabel(hours);
  const failedUsers = users.filter((u) => u.failed > 0).length;
  const rootActive = users.some((u) => u.is_root);
  return [
    {
      id: "critical",
      label: "Critical",
      value: n(counts.critical),
      tone: counts.critical > 0 ? "critical" : "ok",
      ratio: null,
      detail: counts.critical > 0 ? `Rules flagged these in ${span}.` : `None in ${span}.`,
      href: timelineHref("critical", hours),
      cta: "Show critical",
    },
    {
      id: "high",
      label: "High",
      value: n(counts.high),
      tone: counts.high > 0 ? "high" : "ok",
      ratio: null,
      detail: counts.high > 0 ? `Rules flagged these in ${span}.` : `None in ${span}.`,
      href: timelineHref("high", hours),
      cta: "Show high",
    },
    {
      id: "users",
      label: "Active users",
      value: n(users.length),
      tone: rootActive ? "critical" : failedUsers > 0 ? "medium" : "neutral",
      ratio: null,
      detail: rootActive
        ? "Root was used."
        : failedUsers > 0
          ? `${n(failedUsers)} with failed actions.`
          : `Seen in ${span}.`,
      href: timelineHref("users", hours),
      cta: "Show users",
    },
  ];
}

/** Cards for one user: how much they did, whether anything failed, from where. */
export function buildUserCards(data: AwsTimelineUserResponse): HealthCard[] {
  const { summary, hours } = data;
  const span = windowLabel(hours);
  return [
    {
      id: "events",
      label: "Events",
      value: n(summary.events),
      tone: "neutral",
      ratio: null,
      detail: summary.events > 0 ? `Collected in ${span}.` : `Nothing in ${span}.`,
      href: "#timeline",
      cta: "Show timeline",
    },
    {
      id: "failed",
      label: "Failed",
      value: n(summary.failed),
      tone: summary.failed > 0 ? "medium" : "ok",
      ratio: null,
      detail: summary.failed > 0 ? "Actions AWS refused or that errored." : "Nothing failed.",
      href: "#timeline",
      cta: "Show timeline",
    },
    {
      id: "ips",
      label: "Source IPs",
      value: n(summary.source_ips.length),
      tone: summary.source_ips.length > 3 ? "medium" : "neutral",
      ratio: null,
      detail: summary.source_ips.length > 3 ? "Many networks for one user." : "Where the calls came from.",
      href: "#breakdown",
      cta: "Show IPs",
    },
  ];
}

/** Slim row for the activity table: only what it shows. */
export interface AwsActivityRow {
  event_id: string;
  event_time: string;
  severity: string | null;
  principal: string | null;
  action: string;
  failed: boolean;
  target: string | null;
  source_ip: string | null;
}

export function toAwsActivityRow(event: EventEnvelope): AwsActivityRow {
  return {
    event_id: event.event_id,
    event_time: event.event_time,
    severity: (event.severity as string | null | undefined) ?? null,
    principal: event.actor?.principal ?? null,
    action: event.action,
    failed: event.outcome !== undefined && event.outcome !== "success",
    target: (event.target?.id ?? event.target?.name ?? null) as string | null,
    source_ip: (event.actor as { source_ip?: string } | undefined)?.source_ip ?? null,
  };
}

const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Principals and IPs come from outside; keep spreadsheets from running them.
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV of a user's timeline, oldest first so it reads like a history. */
export function eventsToCsv(events: EventEnvelope[]): string {
  const header = ["time", "user", "action", "outcome", "severity", "source_ip", "target", "region"];
  const ordered = [...events].sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time));
  const lines = ordered.map((e) =>
    [
      e.event_time,
      e.actor?.principal,
      e.action,
      e.outcome,
      e.severity,
      (e.actor as { source_ip?: string } | undefined)?.source_ip,
      e.target?.id ?? e.target?.name,
      e.region,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export interface TimelineDay {
  day: string; // YYYY-MM-DD (UTC)
  events: EventEnvelope[];
}

/** Group events (any order) into UTC days, newest day first, newest event first. */
export function groupByDay(events: EventEnvelope[]): TimelineDay[] {
  const sorted = [...events].sort((a, b) => Date.parse(b.event_time) - Date.parse(a.event_time));
  const days: TimelineDay[] = [];
  for (const event of sorted) {
    const day = new Date(event.event_time).toISOString().slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) last.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}
