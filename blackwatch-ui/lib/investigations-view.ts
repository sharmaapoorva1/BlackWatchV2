import type { Investigation, InvestigationStatus } from "./types";
import type { HealthCard } from "./overview";

/** Where a case stands, in three buckets an analyst cares about. */
export type CaseGroup = "active" | "malicious" | "concluded";

export const CASE_GROUPS: CaseGroup[] = ["active", "malicious", "concluded"];

export const CASE_GROUP_LABEL: Record<CaseGroup, string> = {
  active: "Active",
  malicious: "Confirmed malicious",
  concluded: "Concluded",
};

/** ready, investigating, contained and inconclusive cases still need work. */
export function caseGroup(status: InvestigationStatus | string): CaseGroup {
  if (status === "confirmed_malicious") return "malicious";
  if (status === "confirmed_expected" || status === "false_positive" || status === "closed") return "concluded";
  return "active";
}

export function parseCaseGroup(value: string | undefined): CaseGroup | "" {
  return CASE_GROUPS.includes(value as CaseGroup) ? (value as CaseGroup) : "";
}

export function caseCounts(cases: Pick<Investigation, "status">[]): Record<CaseGroup, number> {
  const counts: Record<CaseGroup, number> = { active: 0, malicious: 0, concluded: 0 };
  for (const item of cases) counts[caseGroup(item.status)] += 1;
  return counts;
}

/** Cases in `group` (all when empty), most recently updated first. */
export function filterCases<T extends Pick<Investigation, "status" | "updated_at">>(cases: T[], group: CaseGroup | ""): T[] {
  return cases
    .filter((item) => !group || caseGroup(item.status) === group)
    .sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0));
}

/** Active cases of high or critical priority: the ones to pick up first. */
export function urgentActive(cases: Pick<Investigation, "status" | "priority">[]): number {
  return cases.filter((item) => caseGroup(item.status) === "active" && (item.priority === "high" || item.priority === "critical")).length;
}

export function buildCaseCards(cases: Investigation[]): HealthCard[] {
  const counts = caseCounts(cases);
  const urgent = urgentActive(cases);
  const total = cases.length;
  return [
    {
      id: "active",
      label: "Active cases",
      value: String(counts.active),
      of: total === 0 ? undefined : `of ${total}`,
      tone: counts.active === 0 ? "ok" : urgent > 0 ? "high" : "neutral",
      ratio: total === 0 ? null : counts.active / total,
      detail: counts.active === 0 ? "Nothing is waiting on an analyst." : urgent > 0 ? `${urgent} high or critical priority.` : "Waiting on an analyst.",
      href: "/investigations?group=active#cases",
      cta: "Show active cases",
    },
    {
      id: "malicious",
      label: "Confirmed malicious",
      value: String(counts.malicious),
      tone: counts.malicious > 0 ? "critical" : "ok",
      ratio: null,
      detail: counts.malicious === 0 ? "No case confirmed malicious." : "Confirmed as hostile activity.",
      href: "/investigations?group=malicious#cases",
      cta: "Show these cases",
    },
    {
      id: "concluded",
      label: "Concluded",
      value: String(counts.concluded),
      tone: "neutral",
      ratio: null,
      detail: "Expected, false positive or closed.",
      href: "/investigations?group=concluded#cases",
      cta: "Show concluded cases",
    },
  ];
}
