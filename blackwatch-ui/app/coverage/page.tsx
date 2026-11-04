import Link from "next/link";

import { fetchCoverage } from "@/lib/api";
import type { CoverageRow, CoverageStatus } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { CoverageTable } from "@/components/domain/CoverageTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { TimestampCell } from "@/components/domain/TimestampCell";

export const metadata = { title: "Coverage" };

export default async function CoveragePage() {
  const data = await fetchCoverage();

  return (
    <>
      <PageHeader
        title="Coverage"
        subtitle={`Collector health · freshness measured from the last connector run`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Total" value={data.summary.total} />
        <Metric label="Healthy" value={data.summary.healthy} tone="ok" />
        <Metric label="Needs attention" value={data.summary.attention} tone="warn" />
        <Metric label="Disabled" value={data.summary.disabled} />
        <Metric label="Stale" value={data.summary.stale} tone="warn" />
      </div>

      <DataPanel className="mb-4 overflow-hidden">
        {data.coverage.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-fg-muted">
            No collectors configured. <Link href="/connectors/new" className="text-signal hover:underline">Add a connector →</Link>
          </div>
        ) : (
          <CoverageTable rows={data.coverage} />
        )}
      </DataPanel>

      <p className="max-w-3xl text-xs leading-5 text-fg-subtle">
        {data.zero_event_semantics} See <Link href="/connectors" className="text-signal hover:underline">connectors</Link> for tests and run controls.
      </p>
    </>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div className="rounded-md border border-line-soft bg-surface-1 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">{label}</div>
      <div className={tone === "ok" ? "mt-1 text-xl text-sev-resolved" : tone === "warn" ? "mt-1 text-xl text-sev-high" : "mt-1 text-xl text-fg"}>{value}</div>
    </div>
  );
}

