import clsx from "clsx";

import { fetchServices } from "@/lib/api";
import type {
  ProbeAgent,
  ServiceCounts,
  ServiceTarget,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { ArchivedServicesTable, ProbeAgentsTable, ServicesTable } from "@/components/domain/ServicesTables";
import { toServiceRow } from "@/lib/service-rows";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { SeverityBadge } from "@/components/domain/SeverityBadge";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ServicesPage() {
  const { agents, grouped, counts, archived, archive_threshold_days } =
    await fetchServices();
  const vpcs = Object.keys(grouped).sort();
  // One timestamp for every "down for" label so they agree with each other.
  const now = Date.now();
  const totalLive = vpcs.reduce((acc, vpc) => acc + grouped[vpc].length, 0);
  const totalDown = vpcs.reduce(
    (acc, vpc) => acc + (counts[vpc]?.down ?? 0) + (counts[vpc]?.degraded ?? 0),
    0,
  );

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="Services"
        subtitle={`${totalLive} live · ${totalDown} down · ${archived.length} archived · ${vpcs.length} VPC${vpcs.length === 1 ? "" : "s"}`}
      />

      <section className="space-y-2">
        <SectionLabel>per-VPC probe agents</SectionLabel>
        <DataPanel className="overflow-hidden">
          {agents.length === 0 ? (
            <EmptyState>
              No probe agents have reported yet. Either install one in a VPC,
              or add an <code className="text-fg">aws_ecs_health</code>{" "}
              connector for AWS-side reading.
            </EmptyState>
          ) : (
            <ProbeAgentsTable agents={agents} />
          )}
        </DataPanel>
      </section>

      {vpcs.length === 0 ? (
        <DataPanel className="mt-6 px-6 py-12 text-center">
          <p className="text-sm text-fg-muted">
            No probe targets configured yet. Add some via the FastAPI{" "}
            <code className="text-fg">/ui/services/targets</code> page (Next.js
            port pending).
          </p>
        </DataPanel>
      ) : (
        <div className="mt-6 space-y-6">
          {vpcs.map((vpc) => (
            <VpcPanel
              key={vpc}
              vpc={vpc}
              services={grouped[vpc]}
              counts={counts[vpc]}
              now={now}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <ArchivePanel
          archived={archived}
          thresholdDays={archive_threshold_days}
          now={now}
        />
      )}
    </>
  );
}

// =========================================================================
// agents
// =========================================================================

// =========================================================================
// VPC panel (one per VPC, each contains a services table)
// =========================================================================

function VpcPanel({
  vpc,
  services,
  counts,
  now,
}: {
  vpc: string;
  services: ServiceTarget[];
  counts: ServiceCounts | undefined;
  now: number;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>{vpc}</SectionLabel>
        <CountsLine counts={counts} />
      </div>
      <DataPanel className="overflow-hidden">
        <ServicesTable services={services.map((s) => toServiceRow(s, now))} vpc={vpc} />
      </DataPanel>
    </section>
  );
}

function CountsLine({ counts }: { counts: ServiceCounts | undefined }) {
  if (!counts) {
    return <span className="text-[11px] text-fg-subtle">—</span>;
  }
  const bad = counts.down + counts.degraded;
  return (
    <span className="text-[11px] text-fg-subtle">
      <span className="font-mono text-fg-muted">{counts.total}</span> total
      {bad > 0 && (
        <>
          {" · "}
          <span className="font-mono text-sev-critical">{bad}</span> down
        </>
      )}
      {counts.up > 0 && (
        <>
          {" · "}
          <span className="font-mono text-sev-resolved">{counts.up}</span> up
        </>
      )}
      {counts.unknown > 0 && (
        <>
          {" · "}
          <span className="font-mono">{counts.unknown}</span> unknown
        </>
      )}
      {counts.disabled > 0 && (
        <>
          {" · "}
          <span className="font-mono text-fg-disabled">{counts.disabled}</span>{" "}
          disabled
        </>
      )}
    </span>
  );
}

// =========================================================================
// archive panel — one collapsible table for services down >= threshold,
// rendered below all VPC panels regardless of which VPC they belong to.
// =========================================================================

function ArchivePanel({
  archived,
  thresholdDays,
  now,
}: {
  archived: ServiceTarget[];
  thresholdDays: number;
  now: number;
}) {
  return (
    <section className="mt-6 space-y-2">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline justify-between rounded-md border border-line-soft bg-surface-1 px-4 py-2.5 hover:bg-surface-2">
          <span className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="text-fg-subtle transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            <span className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              archive
            </span>
            <span className="text-xs text-fg-muted">
              services down for ≥ {thresholdDays} day{thresholdDays === 1 ? "" : "s"}
            </span>
          </span>
          <span className="text-[11px] text-fg-subtle">
            <span className="font-mono text-fg-muted">{archived.length}</span>{" "}
            archived
          </span>
        </summary>
        <DataPanel className="mt-2 overflow-hidden">
          <ArchivedServicesTable services={archived.map((s) => toServiceRow(s, now))} />
        </DataPanel>
      </details>
    </section>
  );
}

// =========================================================================
// empty state
// =========================================================================
