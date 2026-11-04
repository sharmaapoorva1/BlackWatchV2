import Link from "next/link";

import { fetchStorageSummary } from "@/lib/api";
import type { StorageGroup } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { StorageGroupCard } from "@/components/domain/StorageGroupCard";
import { StorageEventsTable } from "@/components/domain/StorageEventsTable";

// Sub-domain -> display label + optional deep link. Each group folds together
// the events whose action prefix matches (see _STORAGE_GROUPS on the backend).
const GROUP_META: Array<{ group: StorageGroup; label: string; href?: string }> = [
  { group: "s3",      label: "S3 buckets",       href: "/buckets" },
  { group: "ebs",     label: "EBS + AMI" },
  { group: "rds",     label: "RDS",              href: "/rds" },
  { group: "efs",     label: "EFS" },
  { group: "backup",  label: "AWS Backup" },
  { group: "secrets", label: "Secrets Manager" },
];

export const metadata = { title: "Storage" };

export default async function StoragePage() {
  const summary = await fetchStorageSummary(24);

  return (
    <>
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title="Storage"
        subtitle={`${summary.buckets.total} buckets tracked · ${summary.buckets.public} public · last ${summary.hours}h event activity`}
      />

      <section className="space-y-2">
        <SectionLabel>activity by domain</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {GROUP_META.map((meta) => (
            <StorageGroupCard
              key={meta.group}
              group={meta.group}
              label={meta.label}
              counts={summary.groups[meta.group]}
              hours={summary.hours}
              href={meta.href}
            />
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <div className="flex items-end justify-between gap-4">
          <SectionLabel>S3 security activity</SectionLabel>
          <Link
            href="/events?module=aws.s3.access"
            className="text-xs text-fg-muted hover:text-signal hover:underline"
          >
            view all S3 events →
          </Link>
        </div>
        <DataPanel className="overflow-hidden">
          {summary.recent_s3_security.length === 0 ? (
            <EmptyState>
              <p>No anonymous, Tor, or threat-intelligence S3 access signals in the last {summary.hours} hours.</p>
              <p className="mt-2 text-fg-subtle">
                Normal S3 requests stay out of this view. Use the S3 events link for the full audit stream.
              </p>
            </EmptyState>
          ) : (
            <StorageEventsTable events={summary.recent_s3_security} variant="s3" />
          )}
        </DataPanel>
      </section>

      <section className="mt-6 space-y-2">
        <SectionLabel>recent critical events</SectionLabel>
        <DataPanel className="overflow-hidden">
          {summary.recent_critical.length === 0 ? (
            <EmptyState>
              <p>
                No critical storage events in the last {summary.hours} hours. When
                one fires — a snapshot shared cross-account, a bucket policy
                widened, a backup vault deleted, an EFS mount target opened — it
                appears here with a link straight to the event detail.
              </p>
              <p className="mt-2 text-fg-subtle">
                Browse all storage-category events on the{" "}
                <Link href="/events?category=storage" className="text-signal hover:underline">
                  events page
                </Link>
                .
              </p>
            </EmptyState>
          ) : (
            <StorageEventsTable events={summary.recent_critical} variant="critical" />
          )}
        </DataPanel>
      </section>
    </>
  );
}
