import Link from "next/link";
import clsx from "clsx";

import { fetchAgentIngressDiagnostics, fetchHosts } from "@/lib/api";
import { buildFleetCards, environmentCounts, fleetCounts, parseFleetGroup } from "@/lib/host-health";
import { toHostActivityRow } from "@/lib/host-activity";
import { HostFleetTable } from "@/components/domain/HostFleetTable";
import { HostActivityDataTable } from "@/components/domain/HostActivityDataTable";
import { StatCard } from "@/components/domain/OverviewParts";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Hosts" };

type SearchParams = { health?: string; env?: string; q?: string };

/**
 * Hosts, in the order an operator works:
 *   1. Fleet health : how many are healthy / need attention / silent (each card
 *                     filters the fleet below), plus agent ingestion
 *   2. Fleet        : every host, trouble first, with filters
 *   3. Recent host activity
 *   4. Collection diagnostics (collapsed): ingestion detail
 */
export default async function HostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [{ count, servers, auth, changes }, ingress] = await Promise.all([
    fetchHosts(),
    fetchAgentIngressDiagnostics(1).catch(() => null),
  ]);

  const counts = fleetCounts(servers);
  const cards = buildFleetCards(servers, ingress);
  const environments = environmentCounts(servers);
  const initial = {
    health: parseFleetGroup(params.health),
    environment: params.env ?? "",
    query: params.q ?? "",
  };
  const troubled = counts.attention + counts.silent;

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="Hosts"
        subtitle={
          count === 0
            ? "No hosts have reported yet."
            : `${count} ${count === 1 ? "host" : "hosts"}${troubled > 0 ? ` · ${troubled} ${troubled === 1 ? "needs" : "need"} attention` : " · all reporting"}${environments.length > 1 ? ` · ${environments.map((e) => `${e.count} ${e.env}`).join(", ")}` : ""}`
        }
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Fleet health" description="Select a card to filter the fleet below.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section
          id="fleet"
          title="Fleet"
          description="Hosts needing attention are listed first. Open a host to see its collected evidence."
        >
          {/* Remount when the URL filters change so a card click re-seeds the toolbar. */}
          <HostFleetTable
            key={`${initial.health}|${initial.environment}|${initial.query}`}
            servers={servers}
            initial={initial}
          />
        </Section>

        <Section
          id="activity"
          title="Recent host activity"
          description="SSH and sudo access, and host configuration changes, newest first."
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/events">All events</Link>
            </Button>
          }
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
        </Section>

        {ingress && (
          <Section id="diagnostics" title="Collection diagnostics" description="How reports travel from agents to BlackWatch.">
            <Subsection
              id="host-ingestion"
              title="Agent ingestion"
              summary={`${ingress.transport} transport`}
              defaultOpen={false}
            >
              <DataPanel className="flex flex-wrap items-center gap-x-8 gap-y-4 px-4 py-4">
                <IngestionMetric label="Accept p95" value={ingress.metrics?.acceptance_p95_seconds == null ? "—" : `${ingress.metrics.acceptance_p95_seconds.toFixed(2)}s`} />
                <IngestionMetric label="Processing p95" value={ingress.metrics?.processing_p95_seconds == null ? "—" : `${ingress.metrics.processing_p95_seconds.toFixed(2)}s`} />
                <IngestionMetric label="Retrying" value={String(ingress.metrics?.retrying ?? "—")} tone={(ingress.metrics?.retrying ?? 0) > 0 ? "warn" : undefined} />
                <IngestionMetric label="Quarantined" value={String(ingress.metrics?.quarantined ?? "—")} tone={(ingress.metrics?.quarantined ?? 0) > 0 ? "critical" : undefined} />
                <IngestionMetric label="Oldest active" value={ingress.spool.oldest_active_age_seconds == null ? "clear" : `${Math.round(ingress.spool.oldest_active_age_seconds)}s`} />
              </DataPanel>
            </Subsection>
          </Section>
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
    <div className="min-w-24 space-y-0.5">
      <div className="text-xs text-fg-muted">{label}</div>
      <div
        className={clsx(
          "font-mono text-base tabular-nums",
          tone === "critical" ? "text-sev-critical" : tone === "warn" ? "text-sev-medium" : "text-fg",
        )}
      >
        {value}
      </div>
    </div>
  );
}
