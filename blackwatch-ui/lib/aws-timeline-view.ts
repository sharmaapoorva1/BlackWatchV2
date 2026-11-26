import type { HealthCard } from "./overview";
import type { AwsTimelineResponse, EventEnvelope } from "./types";

export type AwsTimelineTab = "critical" | "high" | "all" | "users";

export const AWS_TIMELINE_TABS: { id: AwsTimelineTab; label: string }[] = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "all", label: "All activity" },
  { id: "users", label: "Users" },
];

export const AWS_TIMELINE_WINDOWS: { hours: number; label: string }[] = [
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
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
  return AWS_TIMELINE_WINDOWS.find((w) => w.hours === hours)?.label ?? `${hours} hours`;
}

export function buildAwsTimelineCards(data: Pick<AwsTimelineResponse, "counts" | "users" | "hours">): HealthCard[] {
  const { counts, users, hours } = data;
  const failedUsers = users.filter((u) => u.failed > 0).length;
  const rootUsers = users.filter((u) => u.is_root).length;
  const span = windowLabel(hours).toLowerCase();
  return [
    {
      id: "critical",
      label: "Critical events",
      value: n(counts.critical),
      tone: counts.critical > 0 ? "critical" : "ok",
      ratio: null,
      detail: counts.critical > 0 ? `Rules marked these critical in the last ${span}.` : `No critical AWS activity in the last ${span}.`,
      href: "?tab=critical",
      cta: "Show critical",
    },
    {
      id: "high",
      label: "High events",
      value: n(counts.high),
      tone: counts.high > 0 ? "high" : "ok",
      ratio: null,
      detail: counts.high > 0 ? `High-severity AWS activity in the last ${span}.` : `No high-severity AWS activity in the last ${span}.`,
      href: "?tab=high",
      cta: "Show high",
    },
    {
      id: "users",
      label: "Active users",
      value: n(users.length),
      tone: rootUsers > 0 ? "critical" : failedUsers > 0 ? "medium" : "neutral",
      ratio: null,
      detail:
        rootUsers > 0
          ? "The root account was active. It should not be used day to day."
          : failedUsers > 0
            ? `${n(failedUsers)} user${failedUsers === 1 ? "" : "s"} had failed actions.`
            : "Users and roles seen in CloudTrail.",
      href: "?tab=users",
      cta: "Show users",
    },
  ];
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
