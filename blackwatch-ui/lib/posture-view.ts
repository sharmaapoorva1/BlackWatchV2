import type { PostureFinding } from "./types";
import type { HealthCard, Tone } from "./overview";

/** `low` covers both low and informational findings. */
export const POSTURE_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type PostureSeverity = (typeof POSTURE_SEVERITIES)[number];

export function parseSeverityFilter(value: string | undefined): PostureSeverity | "" {
  return POSTURE_SEVERITIES.includes(value as PostureSeverity) ? (value as PostureSeverity) : "";
}

/** Which filter bucket a finding's severity belongs to; "" when unrecognised. */
export function severityBucket(severity: string): PostureSeverity | "" {
  if (severity === "informational") return "low";
  return POSTURE_SEVERITIES.includes(severity as PostureSeverity) ? (severity as PostureSeverity) : "";
}

export function tallySeverities(findings: Pick<PostureFinding, "severity">[]): Record<PostureSeverity, number> {
  const c: Record<PostureSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const bucket = severityBucket(f.severity);
    if (bucket) c[bucket]++;
  }
  return c;
}

export function filterFindings<T extends Pick<PostureFinding, "severity">>(findings: T[], severity: PostureSeverity | ""): T[] {
  return severity ? findings.filter((f) => severityBucket(f.severity) === severity) : findings;
}

const isHot = (f: Pick<PostureFinding, "severity">) => f.severity === "critical" || f.severity === "high";

/** Resource types, hottest (most critical plus high findings) first, then by size, then name. */
export function groupByResourceType<T extends Pick<PostureFinding, "severity" | "resource_type">>(findings: T[]): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const f of findings) {
    const list = map.get(f.resource_type) ?? [];
    list.push(f);
    map.set(f.resource_type, list);
  }
  return [...map.entries()].sort(
    ([nameA, a], [nameB, b]) => b.filter(isHot).length - a.filter(isHot).length || b.length - a.length || nameA.localeCompare(nameB),
  );
}

export const resourceTypeLabel = (resourceType: string) => resourceType.replaceAll("_", " ");

/** A group starts open when it has a critical or high finding, or when there are few groups. */
export function groupStartsOpen(findings: Pick<PostureFinding, "severity">[], groupCount: number): boolean {
  return findings.some(isHot) || groupCount <= 3;
}

const LABEL: Record<PostureSeverity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low and info" };
const TONE: Record<PostureSeverity, Tone> = { critical: "critical", high: "high", medium: "medium", low: "neutral" };
const DETAIL: Record<PostureSeverity, string> = {
  critical: "Fix first. Likely exposure.",
  high: "Fix soon.",
  medium: "Plan a fix.",
  low: "Housekeeping.",
};

/** One card per severity bucket; each filters the findings list. */
export function buildPostureCards(findings: Pick<PostureFinding, "severity">[]): HealthCard[] {
  const counts = tallySeverities(findings);
  const total = findings.length;
  return POSTURE_SEVERITIES.map((severity) => ({
    id: severity,
    label: LABEL[severity],
    value: String(counts[severity]),
    of: total > 0 ? `of ${total}` : undefined,
    tone: counts[severity] > 0 ? TONE[severity] : "ok",
    ratio: total > 0 ? counts[severity] / total : null,
    detail: counts[severity] > 0 ? DETAIL[severity] : "None open.",
    href: `/aws-posture?severity=${severity}#findings`,
    cta: `Show ${LABEL[severity].toLowerCase()}`,
  }));
}
