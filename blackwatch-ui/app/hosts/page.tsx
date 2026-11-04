import Link from "next/link";
import clsx from "clsx";

import { fetchAgentIngressDiagnostics, fetchHosts } from "@/lib/api";
import type { EventEnvelope } from "@/lib/types";
import { HostFleetTable } from "@/components/domain/HostFleetTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { PageSection } from "@/components/layout/PageSection";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { HostActivityDataTable } from "@/components/domain/HostActivityDataTable";
import { toHostActivityRow } from "@/lib/host-activity";
import { SeverityBadge, severityBorderBg } from "@/components/domain/SeverityBadge";

export default async function HostsPage() {
  const [{ count, servers, auth, changes }, ingress] = await Promise.all([
    fetchHosts(),
    fetchAgentIngressDiagnostics(1).catch(() => null),
  ]);

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="Hosts"
        subtitle={`${count} EC2 host${count === 1 ? "" : "s"} · fleet health and host activity`}
      />

      <div className="space-y-8">
        <HostFleetTable servers={servers} />

        <PageSection
          title="Recent host activity"
          description="SSH/sudo access and host configuration changes, newest first."
          action={{ href: "/events", label: "All events" }}
          flush
        >
          <DataPanel scrollX>
            {auth.length + changes.length === 0 ? (
              <EmptyState>No host access or configuration activity recorded yet.</EmptyState>
            ) : (
              <HostActivityDataTable
                rows={[
                  ...auth.map((event) => toHostActivityRow(event, "Access")),
                  ...changes.map((event) => toHostActivityRow(event, "Host change")),
                ]}
              />
            )}
          </DataPanel>
        </PageSection>

        {ingress && (
          <PageSection
            title="Agent ingestion"
            description="Transport and processing health for direct host reports."
            flush
          >
            <DataPanel className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-wider text-signal">{ingress.transport}</span>
              <IngestionMetric label="accept p95" value={ingress.metrics?.acceptance_p95_seconds == null ? "—" : `${ingress.metrics.acceptance_p95_seconds.toFixed(2)}s`} />
              <IngestionMetric label="processing p95" value={ingress.metrics?.processing_p95_seconds == null ? "—" : `${ingress.metrics.processing_p95_seconds.toFixed(2)}s`} />
              <IngestionMetric label="retrying" value={String(ingress.metrics?.retrying ?? "—")} tone={(ingress.metrics?.retrying ?? 0) > 0 ? "warn" : undefined} />
              <IngestionMetric label="quarantined" value={String(ingress.metrics?.quarantined ?? "—")} tone={(ingress.metrics?.quarantined ?? 0) > 0 ? "critical" : undefined} />
              <IngestionMetric label="oldest active" value={ingress.spool.oldest_active_age_seconds == null ? "clear" : `${Math.round(ingress.spool.oldest_active_age_seconds)}s`} />
            </DataPanel>
          </PageSection>
        )}
      </div>
    </>
  );
}

function IngestionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "critical";
}) {
  return (
    <div className="min-w-20 space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className={clsx(
        "font-mono text-xs",
        tone === "critical" ? "text-sev-critical" : tone === "warn" ? "text-sev-medium" : "text-fg",
      )}>{value}</div>
    </div>
  );
}
