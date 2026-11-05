import Link from "next/link";

import { fetchServices } from "@/lib/api";
import { sumServiceCounts } from "@/lib/overview";
import { toServiceRow } from "@/lib/service-rows";
import {
  buildServiceCards,
  filterGrouped,
  needsAttention,
  parseStatusFilter,
  vpcStartsOpen,
  vpcSummary,
} from "@/lib/services-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { ArchivedServicesTable, ProbeAgentsTable, ServicesTable } from "@/components/domain/ServicesTables";
import { StatCard } from "@/components/domain/OverviewParts";
import { ActiveFilters } from "@/components/ui/ActiveFilters";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Services" };

type SearchParams = { status?: string };

/**
 * Services, in the order an operator works:
 *   1. Service health   : up / down / degraded cards (each filters the list below)
 *   2. Needs attention  : down, degraded and unknown services, worst first
 *   3. Services by VPC  : every probed service, one collapsible block per VPC
 *   4. Probe agents     : are the probes themselves reporting?
 *   5. Archive          : services down for a long time (collapsed)
 * h1 page, h2 section, h3 VPC / archive block.
 */
export default async function ServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = parseStatusFilter(params.status);
  const { agents, grouped, counts, archived, archive_threshold_days } = await fetchServices();

  // One timestamp for every "down for" label so they agree with each other.
  const now = Date.now();
  const totals = sumServiceCounts(counts);
  const cards = buildServiceCards(counts, agents);
  const attention = needsAttention(grouped);
  const shown = filterGrouped(grouped, status);
  const vpcs = Object.keys(shown).sort();
  const live = totals.total - totals.disabled;
  const problems = totals.down + totals.degraded + totals.unknown;

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="Services"
        subtitle={
          live <= 0
            ? "No probe targets configured yet."
            : `${live} live · ${totals.down > 0 ? `${totals.down} down` : "none down"}${problems - totals.down > 0 ? ` · ${problems - totals.down} degraded or unknown` : ""} · ${archived.length} archived · ${Object.keys(grouped).length} ${Object.keys(grouped).length === 1 ? "VPC" : "VPCs"}`
        }
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Service health" description="Select a card to filter the services below.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        {!status && (
          <Section
            id="attention"
            title="Needs attention"
            description="Down, degraded and unknown services. Worst first, then the longest outage."
          >
            <DataPanel className="overflow-hidden">
              {attention.length === 0 ? (
                <EmptyState tone="ok">Every probed service is up.</EmptyState>
              ) : (
                <ArchivedServicesTable
                  services={attention.map((service) => toServiceRow(service, now))}
                  tableId="services-attention-v2"
                  ariaLabel="Services needing attention"
                />
              )}
            </DataPanel>
          </Section>
        )}

        <Section
          id="services"
          title={status ? `Services: ${status}` : "Services by VPC"}
          description={status ? "Filtered by status. Clear the filter to see every service." : "Every probed service, grouped by VPC."}
          actions={
            status ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/services#services">Clear filter</Link>
              </Button>
            ) : undefined
          }
        >
          {status && <ActiveFilters basePath="/services" params={{ status }} labels={{ status: "Status" }} />}
          {vpcs.length === 0 ? (
            <DataPanel>
              <EmptyState>
                {status
                  ? `No services are ${status}.`
                  : "No probe targets configured yet. Add some via the FastAPI /ui/services/targets page (Next.js port pending)."}
              </EmptyState>
            </DataPanel>
          ) : (
            vpcs.map((vpc) => (
              <Subsection
                key={vpc}
                id={`vpc-${vpc}`}
                title={vpc}
                count={shown[vpc].length}
                summary={vpcSummary(counts[vpc])}
                defaultOpen={vpcStartsOpen(counts[vpc], vpcs.length)}
              >
                <DataPanel className="overflow-hidden">
                  <ServicesTable services={shown[vpc].map((service) => toServiceRow(service, now))} vpc={vpc} />
                </DataPanel>
              </Subsection>
            ))
          )}
        </Section>

        <Section id="agents" title="Probe agents" description="One agent per VPC runs the probes. If it stops, that VPC's results go stale.">
          <DataPanel className="overflow-hidden">
            {agents.length === 0 ? (
              <EmptyState>
                No probe agents have reported yet. Install one in a VPC, or add an{" "}
                <code className="text-fg">aws_ecs_health</code> connector for AWS-side reading.
              </EmptyState>
            ) : (
              <ProbeAgentsTable agents={agents} />
            )}
          </DataPanel>
        </Section>

        {archived.length > 0 && (
          <Section id="archive" title="Archive" description="Services that stopped responding long ago, kept out of the way.">
            <Subsection
              id="services-archive"
              title="Archived services"
              count={archived.length}
              summary={`down for ${archive_threshold_days} day${archive_threshold_days === 1 ? "" : "s"} or more`}
              defaultOpen={false}
            >
              <DataPanel className="overflow-hidden">
                <ArchivedServicesTable services={archived.map((service) => toServiceRow(service, now))} />
              </DataPanel>
            </Subsection>
          </Section>
        )}
      </div>
    </>
  );
}
