import type { EventEnvelope } from "./types";

export type HostActivityKind = "Access" | "Host change";

/** Only the fields the host-activity table renders (no raw payloads). */
export interface HostActivityRow {
  event_id: string;
  event_time: string;
  kind: HostActivityKind;
  /** success/failure for access events. */
  outcome: string | null;
  severity: string | null;
  host_label: string;
  /** Instance id when the target is an EC2 instance, for linking. */
  host_id: string | null;
  action: string;
  /** Plain text detail for host changes. */
  detail: string;
  principal: string | null;
  source_ip: string | null;
}

function hostLabel(event: EventEnvelope): string {
  const extra = (event.extra as Record<string, unknown> | undefined) ?? {};
  const tags = extra.tags as Record<string, string> | undefined;
  return tags?.role ?? event.target?.name ?? event.target?.id ?? "—";
}

/** One-line description of what changed on the host, from the event's extras. */
export function changeDetail(event: EventEnvelope): string {
  const extra = (event.extra as Record<string, unknown> | undefined) ?? {};
  const parts: string[] = [];
  if (extra.port) {
    parts.push(`port ${String(extra.proto ?? "")}/${String(extra.port)} on ${String(extra.address ?? "—")}`);
  } else if (extra.fingerprint) {
    parts.push(`${String(extra.user ?? "")} · fp ${String(extra.fingerprint).slice(0, 12)}`);
  } else if (extra.user) {
    parts.push(`user ${String(extra.user)}`);
  }
  if (extra.path) parts.push(`${String(extra.path)}${extra.change ? ` · ${String(extra.change)}` : ""}`);
  if (extra.unit) parts.push(String(extra.unit));
  if (extra.added_count !== undefined) {
    parts.push(`+${String(extra.added_count)} / −${String(extra.removed_count)} packages`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function toHostActivityRow(event: EventEnvelope, kind: HostActivityKind): HostActivityRow {
  const actor = event.actor as { principal?: string; source_ip?: string } | undefined;
  const targetId = event.target?.id;
  return {
    event_id: event.event_id,
    event_time: event.event_time,
    kind,
    outcome: kind === "Access" ? (event.outcome ?? "unknown") : null,
    severity: (event.severity as string | null | undefined) ?? null,
    host_label: hostLabel(event),
    host_id: typeof targetId === "string" && targetId.startsWith("i-") ? targetId : null,
    action: event.action,
    detail: kind === "Host change" ? changeDetail(event) : "",
    principal: actor?.principal ?? null,
    source_ip: actor?.source_ip ?? null,
  };
}
