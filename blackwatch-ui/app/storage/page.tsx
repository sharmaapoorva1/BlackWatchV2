import Link from "next/link";

import { fetchStorageSummary } from "@/lib/api";
import { buildDomainCards, buildStorageCards } from "@/lib/storage-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { StatCard } from "@/components/domain/OverviewParts";
import { StorageEventsTable } from "@/components/domain/StorageEventsTable";

export const metadata = { title: "Storage" };

/**
 * Storage, in the order an operator works:
 *   1. Needs attention : public buckets, critical events, suspicious S3 access
 *   2. Activity        : one card per storage domain (S3, EBS, RDS, EFS, Backup, Secrets)
 *   3. S3 security     : anonymous, Tor and threat-intel access
 *   4. Critical events : the latest critical storage changes
 */
export default async function StoragePage() {
  const summary = await fetchStorageSummary(24);
  const cards = buildStorageCards(summary);
  const domains = buildDomainCards(summary);

  return (
    <>
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title="Storage"
        subtitle={`${summary.buckets.total} buckets tracked · ${summary.buckets.public} public · last ${summary.hours}h event activity`}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Needs attention" description="Select a card to open the buckets or events behind it.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="domains" title="Activity by domain" description={`Events in the last ${summary.hours}h, by storage service.`}>
          <AutoGrid min="15rem">
            {domains.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section
          id="s3-security"
          title="S3 security activity"
          description="Anonymous, Tor and threat-intelligence access. Normal S3 requests stay out of this view."
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/events?module=aws.s3.access">All S3 events</Link>
            </Button>
          }
        >
          <DataPanel className="overflow-hidden">
            {summary.recent_s3_security.length === 0 ? (
              <EmptyState tone="ok">No anonymous, Tor or threat-intelligence S3 access signals in the last {summary.hours} hours.</EmptyState>
            ) : (
              <StorageEventsTable events={summary.recent_s3_security} variant="s3" />
            )}
          </DataPanel>
        </Section>

        <Section
          id="critical"
          title="Recent critical events"
          description="A snapshot shared cross-account, a bucket policy widened, a backup vault deleted, an EFS mount target opened."
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/events?category=storage">All storage events</Link>
            </Button>
          }
        >
          <DataPanel className="overflow-hidden">
            {summary.recent_critical.length === 0 ? (
              <EmptyState tone="ok">No critical storage events in the last {summary.hours} hours.</EmptyState>
            ) : (
              <StorageEventsTable events={summary.recent_critical} variant="critical" />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}
