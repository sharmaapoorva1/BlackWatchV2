import { hrefWithout } from "./filters";

/** How many events the feed requests. The API returns the newest this many. */
export const EVENT_FEED_LIMIT = 200;

export const SEVERITY_FILTERS = ["critical", "high", "medium", "low", "informational"] as const;
export type SeverityFilter = (typeof SEVERITY_FILTERS)[number];

export const SEVERITY_FILTER_LABEL: Record<SeverityFilter, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Info",
};

// A type alias (not an interface) so it is assignable to Record<string, string | undefined>.
export type EventFilterParams = {
  q?: string;
  severity?: string;
  category?: string;
  module?: string;
  action?: string;
};

/** Severity counts within the events actually shown, plus those with none. */
export function severityMix(events: { severity?: unknown }[]): Record<SeverityFilter | "unscored", number> {
  const mix: Record<SeverityFilter | "unscored", number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0, unscored: 0 };
  for (const event of events) {
    const key = typeof event.severity === "string" ? event.severity : "";
    if (key in mix) mix[key as SeverityFilter] += 1;
    else mix.unscored += 1;
  }
  return mix;
}

/** True when any filter is applied. */
export function hasFilters(params: EventFilterParams): boolean {
  return Object.values(params).some((value) => value !== undefined && value !== "");
}

/**
 * Link for a severity quick-filter chip: selecting the active one clears it,
 * and every other filter is kept.
 */
export function severityChipHref(params: EventFilterParams, severity: SeverityFilter): string {
  const next: Record<string, string | undefined> = { ...params };
  if (params.severity === severity) return hrefWithout("/events", next, "severity");
  next.severity = severity;
  return hrefWithout("/events", next);
}

/** One honest sentence about how much is on screen. */
export function resultsSummary(count: number, filtersActive: boolean): string {
  if (count === 0) return filtersActive ? "No events match these filters." : "No events yet.";
  if (count >= EVENT_FEED_LIMIT) {
    return `Showing the newest ${EVENT_FEED_LIMIT} events${filtersActive ? " that match" : ""}. Narrow the filters to reach older ones.`;
  }
  return `${count} ${count === 1 ? "event" : "events"}${filtersActive ? " match" : ""}, newest first.`;
}
