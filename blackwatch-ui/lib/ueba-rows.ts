import type { EventEnvelope } from "./types";

/** Only the fields the UEBA anomalies table renders. */
export interface UebaAnomalyTableRow {
  event_id: string;
  event_time: string;
  action: string;
  principal_id: string;
  principal_type: string;
  dimension: string;
  value: string;
  trigger_event_id: string;
}

export function toUebaAnomalyRow(event: EventEnvelope): UebaAnomalyTableRow {
  const extra = (event.extra as Record<string, unknown> | undefined) ?? {};
  return {
    event_id: event.event_id,
    event_time: event.event_time,
    action: event.action,
    principal_id: String(extra.principal_id ?? event.actor?.principal ?? ""),
    principal_type: String(extra.principal_type ?? event.actor?.type ?? ""),
    dimension: String(extra.dimension ?? ""),
    value: String(extra.baseline_value ?? ""),
    trigger_event_id: String(extra.trigger_event_id ?? ""),
  };
}

/** Baseline timestamps arrive as epoch seconds; show them as UTC. */
export function formatEpoch(ts: number): string {
  if (!ts) return "";
  try {
    return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch {
    return String(ts);
  }
}
