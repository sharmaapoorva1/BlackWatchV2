import type { EventEnvelope } from "./types";

// Plain-language label for a normalized action id such as
// "host.fim.modified" -> "Host · file integrity modified". The raw id stays
// available (and searchable) next to it; this only improves scanning.

const ACRONYMS: Record<string, string> = {
  iam: "IAM",
  vpn: "VPN",
  rds: "RDS",
  s3: "S3",
  api: "API",
  ssh: "SSH",
  ec2: "EC2",
  ecs: "ECS",
  efs: "EFS",
  kms: "KMS",
  mfa: "MFA",
  dns: "DNS",
  ip: "IP",
  aws: "AWS",
  ueba: "UEBA",
  tls: "TLS",
  cert: "Certificate",
  fim: "file integrity",
  sg: "security group",
  cloudtrail: "CloudTrail",
};

function word(segment: string): string {
  const lower = segment.toLowerCase();
  return ACRONYMS[lower] ?? lower;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

export function summarizeAction(action: string | null | undefined): string {
  if (!action) return "Unknown event";
  const segments = action.split(".").filter(Boolean);
  if (segments.length === 0) return action;
  if (segments.length === 1) return capitalize(word(segments[0].replaceAll("_", " ")));
  const [domain, ...rest] = segments;
  const tail = rest.map((segment) => segment.split("_").map(word).join(" ")).join(" ");
  return `${capitalize(word(domain))} · ${tail}`;
}

/** Best human label for what an event happened to: the per-agent role tag
 *  ("Dev-NAT") first, then the target name, then its id. */
export function eventTargetLabel(event: EventEnvelope): string {
  const extra = (event.extra as Record<string, unknown> | undefined) ?? {};
  const tags =
    (event.tags as Record<string, string> | undefined) ??
    (extra.tags as Record<string, string> | undefined);
  const role = tags && !Array.isArray(tags) ? tags.role : undefined;
  return role ?? event.target?.name ?? event.target?.id ?? "—";
}

/** The few fields the events table shows. Sending this instead of the full
 *  envelope keeps raw payloads out of the page's client-side data. */
export interface EventTableRow {
  event_id: string;
  event_time: string;
  severity: string | null;
  action: string;
  module: string;
  actor: string;
  target: string;
  tags: [string, string][];
}

export function toEventTableRow(event: EventEnvelope): EventTableRow {
  const extra = (event.extra as Record<string, unknown> | undefined) ?? {};
  const tags =
    (event.tags as Record<string, string> | undefined) ??
    (extra.tags as Record<string, string> | undefined);
  return {
    event_id: event.event_id,
    event_time: event.event_time,
    severity: (event.severity as string | null | undefined) ?? null,
    action: event.action,
    module: event.source?.module ?? "",
    actor: event.actor?.principal ?? "",
    target: eventTargetLabel(event),
    tags: Object.entries(tags ?? {}).map(([key, value]) => [key, String(value)] as [string, string]),
  };
}
