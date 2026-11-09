import Link from "next/link";
import { Plus } from "lucide-react";

import { fetchConnectors } from "@/lib/api";
import { toConnectorRow } from "@/lib/connector-rows";
import {
  buildConnectorCards,
  CONNECTOR_GROUPS,
  CONNECTOR_GROUP_LABEL,
  connectorCounts,
  filterConnectors,
  parseConnectorGroup,
  type ConnectorGroup,
} from "@/lib/connectors-view";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { StatCard } from "@/components/domain/OverviewParts";
import { RetryAllButton } from "@/components/domain/connectors/RetryAllButton";
import { ConnectorsTable } from "@/components/domain/connectors/ConnectorsTable";

type SearchParams = { msg?: string; health?: string };

export const metadata = { title: "Connectors" };

/**
 * Connectors, in the order an operator works:
 *   1. Connector health : needs attention / healthy / disabled (cards filter the list)
 *   2. Connectors       : every connector, failing ones first
 */
export default async function ConnectorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg, health } = await searchParams;
  const group = parseConnectorGroup(health);
  let connectorData: Awaited<ReturnType<typeof fetchConnectors>> | null = null;
  let loadError: unknown = null;
  try {
    connectorData = await fetchConnectors();
  } catch (error) {
    loadError = error;
  }
  const count = connectorData?.count ?? 0;
  const connectors = connectorData?.connectors ?? [];
  const scheduler = connectorData?.scheduler;
  const cards = buildConnectorCards(connectors);
  const counts = connectorCounts(connectors);
  const shown = filterConnectors([...connectors], group);

  return (
    <>
      <PageHeader
        title="Connectors"
        subtitle={`${count} configured · poll AWS, SQS, and probe targets on a schedule`}
        actions={
          <div className="flex items-center gap-2">
            <RetryAllButton />
            <Button asChild variant="secondary" size="sm">
              <Link href="/connectors/advanced-queue">Advanced queue</Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/connectors/new">
                <Plus size={14} /> Add connector
              </Link>
            </Button>
          </div>
        }
      />

      {msg && (
        <div role="status" className="mb-4 rounded-md border border-line-soft bg-surface-1 px-3 py-2 text-xs text-fg-muted">
          {msg}
        </div>
      )}

      {loadError ? (
        <div role="alert" className="rounded-md border border-sev-critical/40 bg-sev-critical/5 px-4 py-3 text-sm">
          <h2 className="font-semibold text-sev-critical">Connector service unavailable</h2>
          <p className="mt-1 text-fg-muted">The UI could not read connector data from the API. Existing connector data was not changed.</p>
          <code className="mt-2 block text-xs opacity-80">
            {loadError instanceof Error && /failed: \d{3}/.test(loadError.message)
              ? loadError.message.replace(/^fetchConnectors failed: /, "API status: ")
              : "Check the backend logs and confirm the database migrations completed."}
          </code>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-10">
          {connectors.length > 0 && (
            <Section
              id="health"
              title="Connector health"
              description={
                scheduler?.heartbeat_at ? (
                  <>
                    Select a card to filter the list. Scheduler heartbeat <TimestampCell value={scheduler.heartbeat_at} />.
                  </>
                ) : (
                  "Select a card to filter the list."
                )
              }
            >
              <AutoGrid min="15rem">
                {cards.map((card) => (
                  <StatCard key={card.id} card={card} />
                ))}
              </AutoGrid>
            </Section>
          )}

          <Section id="connectors" title={group ? `Connectors: ${CONNECTOR_GROUP_LABEL[group].toLowerCase()}` : "Connectors"} description="Failing connectors come first.">
            {connectors.length > 0 && (
              <nav aria-label="Filter connectors" className="flex flex-wrap gap-2 text-sm">
                <FilterLink href="/connectors#connectors" active={!group} label="All" count={connectors.length} />
                {CONNECTOR_GROUPS.map((g) => (
                  <FilterLink key={g} href={`/connectors?health=${g}#connectors`} active={group === g} label={CONNECTOR_GROUP_LABEL[g]} count={counts[g]} />
                ))}
              </nav>
            )}
            <DataPanel>
              {connectors.length === 0 ? (
                <EmptyState>
                  No connectors yet.{" "}
                  <Link href="/connectors/new" className="text-signal hover:underline">
                    Add one
                  </Link>
                </EmptyState>
              ) : shown.length === 0 ? (
                <EmptyState>No {group ? CONNECTOR_GROUP_LABEL[group as ConnectorGroup].toLowerCase() : ""} connectors.</EmptyState>
              ) : (
                <ConnectorsTable connectors={shown.map(toConnectorRow)} />
              )}
            </DataPanel>
          </Section>
        </div>
      )}
    </>
  );
}

function FilterLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 transition-colors",
        active ? "border-signal/50 bg-signal/10 text-fg" : "border-line-soft text-fg-muted hover:border-line hover:text-fg",
      )}
    >
      {label}
      <span className="font-mono text-xs text-fg-subtle">{count}</span>
    </Link>
  );
}
