import Link from "next/link";

import { fetchCoverage } from "@/lib/api";
import { buildCoverageCards } from "@/lib/coverage-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { CoverageTable } from "@/components/domain/CoverageTable";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Coverage" };

/**
 * Coverage, in the order an operator works:
 *   1. Collector health : needs attention, stale, healthy, disabled
 *   2. Collectors       : every collector with its freshness
 */
export default async function CoveragePage() {
  const data = await fetchCoverage();
  const cards = buildCoverageCards(data.summary);

  return (
    <>
      <PageHeader title="Coverage" subtitle="Collector health · freshness measured from the last connector run" />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Collector health" description="A collector that is failing or stale means events may be missing.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section
          id="collectors"
          title="Collectors"
          description={
            <>
              {data.zero_event_semantics} See{" "}
              <Link href="/connectors" className="text-signal hover:underline">
                connectors
              </Link>{" "}
              for tests and run controls.
            </>
          }
        >
          <DataPanel className="overflow-hidden">
            {data.coverage.length === 0 ? (
              <EmptyState>
                No collectors configured.{" "}
                <Link href="/connectors/new" className="text-signal hover:underline">
                  Add a connector
                </Link>
              </EmptyState>
            ) : (
              <CoverageTable rows={data.coverage} />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}
