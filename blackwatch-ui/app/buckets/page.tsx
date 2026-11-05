import Link from "next/link";

import { fetchBuckets } from "@/lib/api";
import { buildBucketCards } from "@/lib/storage-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { BucketsDataTable } from "@/components/domain/BucketsDataTable";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "S3 buckets" };

export default async function BucketsPage() {
  const { count, buckets, counts } = await fetchBuckets();
  const cards = buildBucketCards(counts);

  return (
    <>
      <PageHeader
        title="S3 buckets"
        subtitle={`${count} bucket${count === 1 ? "" : "s"} tracked · inventory snapshot`}
        breadcrumbs={[{ label: "Storage", href: "/storage" }, { label: "S3 buckets" }]}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Bucket posture" description="Public, unencrypted and unversioned buckets first.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="buckets" title="All buckets" description="Every tracked bucket with its protection settings.">
          <DataPanel className="overflow-hidden">
            {buckets.length === 0 ? (
              <EmptyState>
                <p>
                  No buckets tracked yet. Either run the bootstrap script (<code className="text-fg">scripts/s3_bucket_inventory.py</code>) to seed the
                  inventory once, or set up an <strong className="text-fg">S3 drift connector</strong> in{" "}
                  <Link href="/settings" className="text-signal hover:underline">
                    Settings
                  </Link>{" "}
                  for ongoing scans.
                </p>
              </EmptyState>
            ) : (
              <BucketsDataTable buckets={buckets} />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}
