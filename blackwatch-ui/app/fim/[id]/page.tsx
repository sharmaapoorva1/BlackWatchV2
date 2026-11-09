import { fetchFimInstance } from "@/lib/api";
import { buildFimCoverageCards } from "@/lib/fim-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { FimChangesTable, FimPathsTable, FimStrayTable } from "@/components/domain/FimTables";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `File integrity · ${decodeURIComponent(id)}` };
}

/**
 * One host's file integrity, in the order an operator works:
 *   1. Coverage        : is detection real-time, is the actor known, did the scan succeed
 *   2. Recent changes  : what changed on this host
 *   3. Monitored paths : what is watched, with file counts
 *   4. Configuration   : how to change what is watched (collapsed)
 */
export default async function FimInstancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchFimInstance(id);
  const cards = data.coverage ? buildFimCoverageCards(data.coverage, Date.now()) : [];

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title={id}
        subtitle={
          data.coverage
            ? `${data.coverage.files_tracked} files tracked · ${data.coverage.paths_configured} paths configured`
            : "no coverage data yet"
        }
        breadcrumbs={[{ label: "FIM", href: "/fim" }, { label: id }]}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="coverage" title="Coverage" description="How this host is being watched.">
          {data.coverage ? (
            <AutoGrid min="14rem">
              {cards.map((card) => (
                <StatCard key={card.id} card={card} />
              ))}
            </AutoGrid>
          ) : (
            <DataPanel>
              <EmptyState>The agent has not reported coverage data yet. Wait about 15 seconds after install for the first heartbeat.</EmptyState>
            </DataPanel>
          )}
        </Section>

        <Section
          id="changes"
          title="Recent file integrity events"
          description={`Last ${data.recent_changes.length} change${data.recent_changes.length === 1 ? "" : "s"} on this host.`}
        >
          <DataPanel className="overflow-hidden">
            {data.recent_changes.length === 0 ? (
              <EmptyState tone="ok">No file integrity events for this instance yet.</EmptyState>
            ) : (
              <FimChangesTable changes={data.recent_changes} scope="host" />
            )}
          </DataPanel>
        </Section>

        <Section id="paths" title="Monitored paths" description="File counts are pulled live from the agent's baseline database.">
          <DataPanel className="overflow-hidden">
            {data.paths_summary.length === 0 ? (
              <EmptyState>No path summary available. Coverage has not been reported yet.</EmptyState>
            ) : (
              <FimPathsTable paths={data.paths_summary} />
            )}
          </DataPanel>
          {data.stray_count > 0 && (
            <Subsection
              id="stray"
              title="Stray baselines"
              count={data.stray_count}
              summary={
                data.stray_count > data.stray_baselines.length
                  ? `not under a configured path · showing first ${data.stray_baselines.length}`
                  : "not under a configured path"
              }
              defaultOpen={false}
            >
              <DataPanel className="overflow-hidden">
                <p className="px-4 pt-3 pb-2 text-xs text-fg-muted">
                  These files were baselined under a path that is no longer in the agent&apos;s configuration. Usually a path was removed from the
                  config but the agent has not been restarted to clean up. The next periodic scan will detect deletions for files outside the current
                  scan scope.
                </p>
                <FimStrayTable stray={data.stray_baselines} />
              </DataPanel>
            </Subsection>
          )}
        </Section>

        <Section id="configuration" title="Configuration" description="Live editing is coming. Today, change paths with environment variables on the host.">
          <Subsection id="configuration-howto" title="Add or remove monitored paths" defaultOpen={false}>
            <DataPanel className="space-y-3 px-4 py-4 text-xs text-fg-muted">
              <p className="text-fg">
                Edit the systemd unit&apos;s environment and restart the agent. Push-from-UI customization is planned for Phase 2 (SSM Parameter Store).
              </p>
              <div className="space-y-1 rounded border border-line-soft bg-surface-2 p-3 font-mono text-xs">
                <div className="text-fg-subtle"># on the host (root):</div>
                <div>sudo systemctl edit blackwatch-agent</div>
                <div className="text-fg-subtle"># add to [Service]:</div>
                <div>Environment=BLACKWATCH_FIM_EXTRA_FILES=/etc/redis/redis.conf,/etc/postgresql/postgresql.conf</div>
                <div>Environment=BLACKWATCH_FIM_EXTRA_DIRS=/etc/nginx,/etc/letsencrypt</div>
                <div className="text-fg-subtle"># then:</div>
                <div>sudo systemctl restart blackwatch-agent</div>
              </div>
              <p>Within about 15 seconds (first scan) the new paths appear in Monitored paths with their file counts.</p>
            </DataPanel>
          </Subsection>
        </Section>
      </div>
    </>
  );
}
