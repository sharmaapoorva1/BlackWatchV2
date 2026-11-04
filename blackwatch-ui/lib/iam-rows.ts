import type { EventEnvelope } from "./types";

// Slim, serializable rows for the IAM tables. The detail cells used to read the
// whole event (including raw payloads); they are now composed here, on the
// server, into plain text segments the client table just renders in order.

export interface DetailSegment {
  text: string;
  tone?: "critical" | "medium" | "strong";
}

export interface IamRow {
  event_id: string;
  event_time: string;
  severity: string | null;
  action: string;
  principal: string | null;
  outcome: string | null;
  source_ip: string | null;
  login_kind: string;
  target: string;
  detail: DetailSegment[];
}

export type IamDetailMode = "plain" | "sg" | "exposure";

function extraOf(event: EventEnvelope): Record<string, unknown> {
  return (event.extra as Record<string, unknown> | undefined) ?? {};
}

/** Security-group change detail: target, port/proto, source, risk flag. */
export function sgDetail(event: EventEnvelope, fallback: string): DetailSegment[] {
  const extra = extraOf(event);

  if (event.action === "network.sg.instance_attach") {
    const instanceId = String(extra.instance_id ?? event.target?.id ?? "—");
    const sgIds = Array.isArray(extra.sg_ids) ? (extra.sg_ids as string[]) : [];
    const segments: DetailSegment[] = [{ text: instanceId }];
    if (sgIds.length > 0) {
      segments.push({ text: ` · attached ${sgIds.length} SG${sgIds.length === 1 ? "" : "s"}: ` });
    }
    sgIds.forEach((id, index) => {
      segments.push({ text: id, tone: "strong" });
      if (index < sgIds.length - 1) segments.push({ text: ", " });
    });
    return segments;
  }

  const parts: DetailSegment[] = [];
  const sg = event.target?.id ?? event.target?.name;
  if (sg) parts.push({ text: String(sg) });

  const port = extra.port ?? extra.from_port;
  const toPort = extra.to_port;
  const proto = extra.proto ?? extra.ip_protocol;
  if (port !== undefined) {
    parts.push({
      text: `${String(proto ?? "tcp")}/${String(port)}${toPort !== undefined && toPort !== port ? `–${String(toPort)}` : ""}`,
    });
  }

  const cidr = extra.cidr ?? extra.cidr_ip ?? extra.address;
  if (cidr) parts.push({ text: `from ${String(cidr)}` });

  if (extra.public_ingress_risky_port) {
    parts.push({ text: "⚠ public risky port", tone: "critical" });
  } else if (extra.public_ingress) {
    parts.push({ text: "public ingress", tone: "medium" });
  }

  if (parts.length === 0) return [{ text: fallback }];
  return parts.flatMap((part, index) => (index === 0 ? [part] : [{ text: " · " }, part]));
}

/** Storage/compute exposure detail: the target plus every exposure flag set. */
export function exposureDetail(event: EventEnvelope, fallback: string): DetailSegment[] {
  const extra = extraOf(event);
  const target = event.target?.id ?? event.target?.name ?? fallback;
  const flags: string[] = [];
  if (extra.public_acl) flags.push("public ACL");
  if (extra.public_policy) flags.push("public policy");
  if (extra.bpa_weakened) flags.push("BPA weakened");
  if (extra.versioning_suspended) flags.push("versioning suspended");
  if (extra.mfa_delete_disabled) flags.push("MFA-delete disabled");
  if (extra.logging_disabled) flags.push("logging disabled");
  if (extra.snapshot_made_public) flags.push("snapshot → public");
  if (extra.ami_made_public) flags.push("AMI → public");
  if (extra.imdsv1_enabled) flags.push("IMDSv1 enabled");

  const segments: DetailSegment[] = [{ text: String(target) }];
  if (flags.length > 0) segments.push({ text: ` · ${flags.join(" · ")}`, tone: "critical" });
  return segments;
}

export function toIamRow(event: EventEnvelope, mode: IamDetailMode = "plain"): IamRow {
  const extra = extraOf(event);
  const target = event.target?.id ?? event.target?.name ?? "—";
  return {
    event_id: event.event_id,
    event_time: event.event_time,
    severity: (event.severity as string | null | undefined) ?? null,
    action: event.action,
    principal: event.actor?.principal ?? null,
    outcome: event.outcome ?? null,
    source_ip: (event.actor as { source_ip?: string } | undefined)?.source_ip ?? null,
    login_kind: String(extra.login_kind ?? "iam").toLowerCase(),
    target,
    detail:
      mode === "sg" ? sgDetail(event, target) : mode === "exposure" ? exposureDetail(event, target) : [{ text: target }],
  };
}

/** Posture findings that arrive as events, reduced to what the table shows. */
export interface IamPostureRow {
  event_id: string;
  event_time: string;
  severity: string | null;
  finding_id: string | null;
  finding_type: string;
  region: string;
  resource_id: string;
}

export function toIamPostureRow(event: EventEnvelope): IamPostureRow {
  const extra = extraOf(event);
  return {
    event_id: event.event_id,
    event_time: event.event_time,
    severity: (event.severity as string | null | undefined) ?? null,
    finding_id: (extra.finding_id as string | undefined) ?? null,
    finding_type: String(extra.finding_type ?? event.action),
    region: String(extra.region ?? "—"),
    resource_id: String(extra.resource_id ?? event.target?.id ?? "—"),
  };
}
