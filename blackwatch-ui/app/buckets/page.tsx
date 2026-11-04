import Link from "next/link";
import clsx from "clsx";

import { fetchBuckets } from "@/lib/api";
import type {
  BucketStatus,
  BlockPublicAccess,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { BucketsDataTable } from "@/components/domain/BucketsDataTable";
import { PageSection } from "@/components/layout/PageSection";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { StatusDot } from "@/components/ui/StatusDot";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function BucketsPage() {
  const { count, buckets, counts } = await fetchBuckets();

  return (
    <>
      <PageHeader
        title="S3 buckets"
        subtitle={`${count} bucket${count === 1 ? "" : "s"} tracked · inventory snapshot`}
        breadcrumbs={[{ label: "Storage", href: "/storage" }, { label: "S3 buckets" }]}
      />

      <CountersGrid counts={counts} />

      <PageSection title="All buckets">
        <DataPanel className="overflow-hidden">
          {buckets.length === 0 ? (
            <EmptyState>
              <p>
                No buckets tracked yet. Either run the bootstrap script
                (<code className="text-fg">scripts/s3_bucket_inventory.py</code>) to seed
                the inventory once, or set up an{" "}
                <strong className="text-fg">S3 drift connector</strong> in{" "}
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
      </PageSection>
    </>
  );
}

// --- counters ------------------------------------------------------------

function CountersGrid({
  counts,
}: {
  counts: { total: number; public: number; unencrypted: number; no_versioning: number };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <CountCell label="Total" count={counts.total} tone="neutral" />
      <CountCell label="Public" count={counts.public} tone={counts.public > 0 ? "bad" : "ok"} />
      <CountCell
        label="Unencrypted"
        count={counts.unencrypted}
        tone={counts.unencrypted > 0 ? "warn" : "ok"}
      />
      <CountCell
        label="No versioning"
        count={counts.no_versioning}
        tone={counts.no_versioning > 0 ? "warn" : "ok"}
      />
    </div>
  );
}

function CountCell({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const dotSeverity =
    tone === "ok"
      ? "resolved"
      : tone === "warn"
        ? "medium"
        : tone === "bad"
          ? "critical"
          : "neutral";
  const textColor =
    tone === "neutral" || count === 0
      ? "text-fg"
      : tone === "bad"
        ? "text-sev-critical"
        : tone === "warn"
          ? "text-sev-medium"
          : "text-fg";
  return (
    <div className="border border-line-soft bg-surface-1 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        {tone !== "neutral" && (
          <StatusDot severity={dotSeverity} className="translate-y-[-3px]" />
        )}
        <span className={clsx("font-mono text-3xl tabular-nums", textColor)}>
          {count}
        </span>
      </div>
    </div>
  );
}
