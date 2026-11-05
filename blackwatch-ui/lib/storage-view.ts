import type { StorageGroup, StorageSummary } from "./types";
import type { HealthCard, Tone } from "./overview";

const n = (value: number) => value.toLocaleString("en-US");

/** Storage domains, in display order. `href` deep-links to a dedicated page. */
export const STORAGE_DOMAINS: Array<{ group: StorageGroup; label: string; href: string }> = [
  { group: "s3", label: "S3 buckets", href: "/buckets" },
  { group: "ebs", label: "EBS and AMI", href: "/events?category=storage" },
  { group: "rds", label: "RDS", href: "/rds" },
  { group: "efs", label: "EFS", href: "/events?category=storage" },
  { group: "backup", label: "AWS Backup", href: "/events?category=storage" },
  { group: "secrets", label: "Secrets Manager", href: "/events?category=storage" },
];

/** Needs-attention cards: public buckets, critical events, S3 access signals. */
export function buildStorageCards(summary: StorageSummary): HealthCard[] {
  const critical = Object.values(summary.groups).reduce((total, g) => total + g.critical, 0);
  const signals = summary.recent_s3_security.length;
  return [
    {
      id: "public",
      label: "Public buckets",
      value: n(summary.buckets.public),
      of: `of ${n(summary.buckets.total)} tracked`,
      tone: summary.buckets.public > 0 ? "critical" : "ok",
      ratio: summary.buckets.total > 0 ? summary.buckets.public / summary.buckets.total : null,
      detail: summary.buckets.public > 0 ? "Open to the internet. Confirm each is intended." : "No bucket is public.",
      href: "/buckets",
      cta: "Open buckets",
    },
    {
      id: "critical",
      label: "Critical events",
      value: n(critical),
      tone: critical > 0 ? "critical" : "ok",
      ratio: null,
      detail: critical > 0 ? `Critical storage changes in the last ${summary.hours}h.` : `No critical storage changes in the last ${summary.hours}h.`,
      href: "#critical",
      cta: "Show events",
    },
    {
      id: "s3-signals",
      label: "S3 access signals",
      value: n(signals),
      tone: signals > 0 ? "high" : "ok",
      ratio: null,
      detail: signals > 0 ? "Anonymous, Tor or threat-intel access." : `No suspicious S3 access in the last ${summary.hours}h.`,
      href: "#s3-security",
      cta: "Show signals",
    },
  ];
}

/** One card per storage domain: activity in the window, toned by worst severity. */
export function buildDomainCards(summary: StorageSummary): HealthCard[] {
  return STORAGE_DOMAINS.map(({ group, label, href }) => {
    const counts = summary.groups[group] ?? { total: 0, critical: 0, high: 0 };
    const tone: Tone = counts.critical > 0 ? "critical" : counts.high > 0 ? "high" : "neutral";
    const parts = [counts.critical > 0 ? `${counts.critical} critical` : null, counts.high > 0 ? `${counts.high} high` : null].filter(Boolean);
    return {
      id: group,
      label,
      value: n(counts.total),
      of: `events in ${summary.hours}h`,
      tone,
      ratio: null,
      detail: parts.length > 0 ? parts.join(" · ") : "Nothing critical or high.",
      href,
      cta: "Open",
    };
  });
}

export type BucketCounts = { total: number; public: number; unencrypted: number; no_versioning: number };

/** Bucket posture cards for the S3 inventory page. */
export function buildBucketCards(counts: BucketCounts): HealthCard[] {
  const share = (value: number) => (counts.total > 0 ? value / counts.total : null);
  return [
    { id: "public", label: "Public", value: n(counts.public), of: `of ${n(counts.total)}`, tone: counts.public > 0 ? "critical" : "ok", ratio: share(counts.public), detail: counts.public > 0 ? "Reachable without credentials." : "None are public.", href: "#buckets", cta: "Show buckets" },
    { id: "unencrypted", label: "Unencrypted", value: n(counts.unencrypted), of: `of ${n(counts.total)}`, tone: counts.unencrypted > 0 ? "medium" : "ok", ratio: share(counts.unencrypted), detail: counts.unencrypted > 0 ? "No default encryption set." : "All have default encryption.", href: "#buckets", cta: "Show buckets" },
    { id: "versioning", label: "No versioning", value: n(counts.no_versioning), of: `of ${n(counts.total)}`, tone: counts.no_versioning > 0 ? "medium" : "ok", ratio: share(counts.no_versioning), detail: counts.no_versioning > 0 ? "Deleted or overwritten objects cannot be recovered." : "Versioning is on everywhere.", href: "#buckets", cta: "Show buckets" },
    { id: "total", label: "Buckets tracked", value: n(counts.total), tone: "neutral", ratio: null, detail: "Inventory snapshot.", href: "#buckets", cta: "Show buckets" },
  ];
}
