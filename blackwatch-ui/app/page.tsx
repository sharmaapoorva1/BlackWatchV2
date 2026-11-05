import Link from "next/link";

import {
  fetchAgentIngressDiagnostics,
  fetchConnectors,
  fetchOverview,
  fetchServices,
} from "@/lib/api";
import { buildAttentionItems } from "@/lib/attention";
import { toEventTableRow } from "@/lib/event-summary";
import { buildHealthCards, severityBreakdown, sumServiceCounts } from "@/lib/overview";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { AttentionStrip } from "@/components/domain/AttentionStrip";
import { EventsDataTable } from "@/components/domain/EventsDataTable";
import { BreakdownList, StatCard } from "@/components/domain/OverviewParts";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Overview" };

/**
 * Overview, in the order an operator works:
 *   1. Needs attention  : act on the top item
 *   2. System health    : is everything collecting? (6 signals, each a link)
 *   3. Detections       : triage queue + where findings sit
 *   4. Latest activity  : the raw tail, for orientation
 * h1 page, h2 section, h3 panel.
 */
export default async function Home() {
  // Overview is the one required call. Everything else only enriches the page,
  // so a failure there shows as "could not load" rather than taking it down.
  const [data, connectors, ingress, services] = await Promise.all([
    fetchOverview(),
    fetchConnectors().catch(() => null),
    fetchAgentIngressDiagnostics(1).catch(() => null),
    fetchServices().catch(() => null),
  ]);

  const serviceCounts = services ? sumServiceCounts(services.counts) : null;
  const attention = buildAttentionItems({ overview: data, connectors, ingress, services: serviceCounts });
  const cards = buildHealthCards({ overview: data, connectors, ingress, services: services?.counts ?? null });
  const severityRows = severityBreakdown(data.severity_counts);
  const critical = attention.filter((item) => item.level === "critical").length;

  return (
    <>
      <AutoRefresh intervalMs={10_000} />
      <PageHeader
        title="Overview"
        subtitle={
          attention.length === 0
            ? "Everything is healthy."
            : `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} attention${critical > 0 ? `, ${critical} critical` : ""}.`
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/events">Browse events</Link>
          </Button>
        }
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="attention" title="Needs attention" description="Most urgent first. Each row opens the view that resolves it.">
          <AttentionStrip items={attention} />
        </Section>

        <Section id="health" title="System health" description="Is every source collecting, and is anything it watches unhealthy?">
          <AutoGrid min="16rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="detections" title="Detections" description="What to triage now, and where findings sit.">
          <AutoGrid min="30rem" gap="lg">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <SectionLabel as="h3">Needs triage</SectionLabel>
                <Link href="/events?severity=high" className="text-xs text-signal hover:underline">
                  All high and critical
                </Link>
              </div>
              <p className="text-xs text-fg-muted">The 10 most recent high or critical events.</p>
              <DataPanel className="overflow-hidden">
                {data.notable.length === 0 ? (
                  <EmptyState tone="ok">No high or critical events lately.</EmptyState>
                ) : (
                  <EventsDataTable
                    events={data.notable.map(toEventTableRow)}
                    variant="compact"
                    tableId="overview-notable"
                    ariaLabel="Recent high and critical events"
                  />
                )}
              </DataPanel>
            </div>

            <div className="min-w-0 space-y-2">
              <SectionLabel as="h3">Events by severity</SectionLabel>
              <p className="text-xs text-fg-muted">All stored events. Open a row to see just those.</p>
              <DataPanel className="overflow-hidden">
                <BreakdownList
                  rows={severityRows}
                  hrefFor={(row) => (row.key === "unscored" ? null : `/events?severity=${row.key}`)}
                  emptyText="No events stored yet."
                />
              </DataPanel>
            </div>
          </AutoGrid>
        </Section>

        <Section
          id="activity"
          title="Latest activity"
          description="The 10 most recent events from every source."
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/events">All events</Link>
            </Button>
          }
        >
          <DataPanel className="overflow-hidden">
            {data.recent.length === 0 ? (
              <EmptyState>No events yet. Has an agent or connector reported?</EmptyState>
            ) : (
              <EventsDataTable
                events={data.recent.map(toEventTableRow)}
                variant="compact"
                tableId="overview-recent"
                ariaLabel="Latest events"
              />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}
