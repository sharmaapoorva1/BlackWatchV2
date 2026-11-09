import Link from "next/link";

import { fetchPostureFindings } from "@/lib/api";
import {
  buildPostureCards,
  filterFindings,
  groupByResourceType,
  groupStartsOpen,
  parseSeverityFilter,
  resourceTypeLabel,
} from "@/lib/posture-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { PostureFindingsTable } from "@/components/domain/PostureFindingsTable";
import { StatCard } from "@/components/domain/OverviewParts";
import { ActiveFilters } from "@/components/ui/ActiveFilters";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "AWS posture" };

/**
 * AWS posture, in the order an operator works:
 *   1. Findings by severity : cards that filter the list (?severity=)
 *   2. Findings             : one collapsible block per resource type, hottest first
 * h1 page, h2 section, h3 resource type.
 */
export default async function AwsPosturePage({ searchParams }: { searchParams: Promise<{ severity?: string }> }) {
  const params = await searchParams;
  const severity = parseSeverityFilter(params.severity);
  const { count, findings, have_connector } = await fetchPostureFindings();

  const cards = buildPostureCards(findings);
  const shown = filterFindings(findings, severity);
  const grouped = groupByResourceType(shown);

  return (
    <>
      <AutoRefresh intervalMs={30_000} />
      <PageHeader title="AWS posture" subtitle={`${count} open finding${count === 1 ? "" : "s"} · drift-detected, current state`} />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Findings by severity" description="Select a card to filter the findings below.">
          <AutoGrid min="13rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section
          id="findings"
          title={severity ? `Findings: ${severity}` : "Findings"}
          description="Grouped by resource type. Types with critical or high findings come first and start open."
          actions={
            severity ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/aws-posture#findings">Clear filter</Link>
              </Button>
            ) : undefined
          }
        >
          {severity && <ActiveFilters basePath="/aws-posture" params={{ severity }} labels={{ severity: "Severity" }} />}
          {grouped.length === 0 ? (
            <DataPanel>
              <EmptyState tone={findings.length > 0 ? "neutral" : "ok"}>
                {findings.length > 0 ? (
                  `No open ${severity} findings.`
                ) : have_connector ? (
                  <>
                    No open findings. Either nothing is wrong, or the connector has not run yet. Try <em className="not-italic text-fg">Run now</em> on the
                    connector in Settings.
                  </>
                ) : (
                  <>
                    No findings yet. Set up an <strong className="text-fg">AWS posture drift connector</strong> in{" "}
                    <Link href="/settings" className="text-signal hover:underline">
                      Settings
                    </Link>{" "}
                    to start scanning.
                  </>
                )}
              </EmptyState>
            </DataPanel>
          ) : (
            grouped.map(([resourceType, group]) => (
              <Subsection
                key={resourceType}
                id={`type-${resourceType}`}
                title={resourceTypeLabel(resourceType)}
                count={group.length}
                defaultOpen={groupStartsOpen(group, grouped.length)}
              >
                <DataPanel className="overflow-hidden">
                  <PostureFindingsTable
                    findings={group}
                    tableId={`aws-posture-${resourceType}`}
                    ariaLabel={`${resourceTypeLabel(resourceType)} findings`}
                  />
                </DataPanel>
              </Subsection>
            ))
          )}
        </Section>
      </div>
    </>
  );
}
