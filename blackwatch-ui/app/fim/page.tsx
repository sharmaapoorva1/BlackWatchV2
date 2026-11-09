import { fetchFimView } from "@/lib/api";
import { buildFimOverviewCards } from "@/lib/fim-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { FimChangesTable, FimHostsTable } from "@/components/domain/FimTables";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "File integrity" };

/**
 * File integrity, in the order an operator works:
 *   1. Coverage    : hosts not reporting, and hosts with weaker detection
 *   2. Hosts       : every monitored host with its coverage
 *   3. Activity    : the latest changes across all hosts
 */
export default async function FimPage() {
  const { count, hosts, recent_changes } = await fetchFimView();
  const cards = buildFimOverviewCards(hosts, recent_changes.length);

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="File integrity monitoring"
        subtitle={`${count} host${count === 1 ? "" : "s"} monitored · inotify + auditd whodata + 6h baseline scan`}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Coverage" description="A host that stops reporting, or loses real-time watching, can miss a change.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="hosts" title="Monitored hosts" description="Select a host for its paths, baselines and change history.">
          <DataPanel className="overflow-hidden">
            {hosts.length === 0 ? (
              <EmptyState>No hosts are reporting FIM data yet. Install the EC2 agent (v1.3+); FIM auto-enables on first start.</EmptyState>
            ) : (
              <FimHostsTable hosts={hosts} now={Date.now()} />
            )}
          </DataPanel>
        </Section>

        <Section
          id="activity"
          title="Recent file integrity activity"
          description={`Last ${recent_changes.length} change${recent_changes.length === 1 ? "" : "s"} across all hosts.`}
        >
          <DataPanel className="overflow-hidden">
            {recent_changes.length === 0 ? (
              <EmptyState tone="ok">
                No file integrity changes recorded across any host. Either the agents just established their baselines or nothing has drifted.
              </EmptyState>
            ) : (
              <FimChangesTable changes={recent_changes} scope="all-hosts" />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}
