import type { IamCounts } from "./types";
import type { HealthCard } from "./overview";

const n = (value: number) => value.toLocaleString("en-US");

/** Failed sign-ins: 5 or more is a likely attack, any is worth a look. */
export const failedLoginTone = (failed: number) => (failed >= 5 ? "critical" : failed > 0 ? "medium" : "ok");

/** Cards for the signals that need a person: each links to the stream behind it. */
export function buildIamCards(counts: IamCounts): HealthCard[] {
  const changes = counts.iam_changes + counts.sg_changes + counts.network_topology + counts.kms_changes;
  return [
    {
      id: "root",
      label: "Root logins",
      value: n(counts.logins_root),
      tone: counts.logins_root > 0 ? "critical" : "ok",
      ratio: null,
      detail: counts.logins_root > 0 ? "The root account should not be used day to day." : "Root has not signed in.",
      href: "#iam-logins",
      cta: "Show logins",
    },
    {
      id: "failed",
      label: "Failed logins",
      value: n(counts.logins_failed),
      of: `of ${n(counts.logins_ok + counts.logins_failed)} sign-ins`,
      tone: failedLoginTone(counts.logins_failed),
      ratio: counts.logins_ok + counts.logins_failed > 0 ? counts.logins_failed / (counts.logins_ok + counts.logins_failed) : null,
      detail: counts.logins_failed >= 5 ? "Repeated failures. Check for guessing." : counts.logins_failed > 0 ? "A few failed sign-ins." : "No failed sign-ins.",
      href: "#iam-logins",
      cta: "Show logins",
    },
    {
      id: "mfa",
      label: "MFA disabled",
      value: n(counts.mfa_disabled),
      tone: counts.mfa_disabled > 0 ? "critical" : "ok",
      ratio: null,
      detail: counts.mfa_disabled > 0 ? "Someone removed a second factor." : "No MFA removals.",
      href: "#iam-changes",
      cta: "Show IAM changes",
    },
    {
      id: "exposure",
      label: "Storage exposure",
      value: n(counts.storage_exposure),
      tone: counts.storage_exposure > 0 ? "critical" : "ok",
      ratio: null,
      detail: counts.storage_exposure > 0 ? "Something was made public or weaker." : "Nothing was made public.",
      href: "#iam-exposure",
      cta: "Show exposure",
    },
    {
      id: "tamper",
      label: "CloudTrail tamper",
      value: n(counts.ct_tamper),
      tone: counts.ct_tamper > 0 ? "critical" : "ok",
      ratio: null,
      detail: counts.ct_tamper > 0 ? "The audit trail itself was touched." : "Audit trail untouched.",
      href: "#iam-tamper",
      cta: "Show tamper events",
    },
    {
      id: "changes",
      label: "Config changes",
      value: n(changes),
      tone: "neutral",
      ratio: null,
      detail: "IAM, security group, network and KMS changes.",
      href: "#access",
      cta: "Show changes",
    },
  ];
}
