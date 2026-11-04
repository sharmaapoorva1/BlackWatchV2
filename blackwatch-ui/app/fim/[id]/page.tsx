import Link from "next/link";
import clsx from "clsx";

import { fetchFimInstance } from "@/lib/api";
import type {
  FimChange,
  FimCoverage,
  FimPathSummary,
  FimStrayBaseline,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { FimChangesTable, FimPathsTable, FimStrayTable } from "@/components/domain/FimTables";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { TimestampCell } from "@/components/domain/TimestampCell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `File integrity · ${decodeURIComponent(id)}` };
}

export default async function FimInstancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchFimInstance(id);

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

      <CoverageSection coverage={data.coverage} />

      <PathsSection
        summary={data.paths_summary}
        instanceId={id}
      />

      {data.stray_count > 0 && (
        <StraySection
          stray={data.stray_baselines}
          count={data.stray_count}
        />
      )}

      <RecentChangesSection changes={data.recent_changes} />

      <ConfigurationHelpSection instanceId={id} />
    </>
  );
}

// =========================================================================
// coverage card
// =========================================================================

function CoverageSection({ coverage }: { coverage: FimCoverage | null }) {
  if (!coverage) {
    return (
      <section className="mt-6 space-y-2">
        <SectionLabel>coverage</SectionLabel>
        <DataPanel className="px-6 py-10 text-center text-sm text-fg-muted">
          Agent hasn&apos;t reported coverage data yet. Wait ~15 seconds after
          install for the first heartbeat.
        </DataPanel>
      </section>
    );
  }

  const lastScan = coverage.last_full_scan_at
    ? new Date(coverage.last_full_scan_at)
    : null;
  const lastScanAge = lastScan
    ? humanAge((Date.now() - lastScan.getTime()) / 1000)
    : "—";

  const realtime = coverage.inotify_active;
  const whodata = coverage.auditd_active;
  const realtimeValue = realtime
    ? `${coverage.inotify_watch_count} watches · sub-second`
    : "inactive";
  const whodataValue = whodata
    ? "auditd active · actor attribution on"
    : "inactive";

  return (
    <section className="mt-6 space-y-2">
      <SectionLabel>coverage</SectionLabel>
      <DataPanel className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-5">
          <Stat
            label="Real-time (inotify)"
            value={realtimeValue}
            tone={realtime ? "ok" : "warn"}
          />
          <Stat
            label="Whodata (auditd)"
            value={whodataValue}
            tone={whodata ? "ok" : "warn"}
          />
          <Stat label="Files tracked" value={String(coverage.files_tracked)} />
          <Stat label="Last full scan" value={lastScanAge} />
          <Stat
            label="Scan errors"
            value={String(coverage.scan_errors)}
            tone={coverage.scan_errors > 0 ? "warn" : undefined}
          />
        </div>
      </DataPanel>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </div>
      <div
        className={clsx(
          "font-mono text-sm",
          tone === "warn"
            ? "text-sev-medium"
            : tone === "ok"
            ? "text-sev-resolved"
            : "text-fg",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// =========================================================================
// configured paths — grouped table with file counts
// =========================================================================

function PathsSection({
  summary,
  instanceId: _instanceId,
}: {
  summary: FimPathSummary[];
  instanceId: string;
}) {
  // Group by category for visual clarity. The API returns them in order
  // already, but we re-group so headers can render between blocks.
  const byCategory = new Map<string, FimPathSummary[]>();
  for (const p of summary) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }

  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>monitored paths</SectionLabel>
        <span className="text-[11px] text-fg-subtle">
          file counts pulled live from the agent&apos;s baseline DB
        </span>
      </div>
      <DataPanel className="overflow-hidden">
        {summary.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-fg-muted">
            No path summary available — coverage hasn&apos;t been reported yet.
          </div>
        ) : (
          <FimPathsTable paths={summary} />
        )}
      </DataPanel>
    </section>
  );
}

// =========================================================================
// stray baselines (in baseline DB but not under any configured path)
// =========================================================================

function StraySection({
  stray,
  count,
}: {
  stray: FimStrayBaseline[];
  count: number;
}) {
  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>stray baselines · not under a configured path</SectionLabel>
        <span className="text-[11px] text-fg-subtle">
          {count} file{count === 1 ? "" : "s"}
          {count > stray.length && ` · showing first ${stray.length}`}
        </span>
      </div>
      <DataPanel className="overflow-hidden">
        <p className="px-4 pt-3 pb-2 text-xs text-fg-muted">
          These files were baselined under a path that&apos;s no longer in the
          agent&apos;s configuration. Usually means a path was removed from the
          config but the agent hasn&apos;t been restarted to clean up. The
          next periodic scan will detect deletions for files outside the
          current scan scope.
        </p>
        <FimStrayTable stray={stray} />
      </DataPanel>
    </section>
  );
}

// =========================================================================
// recent changes (per-instance) — same shape as the global table
// =========================================================================

function RecentChangesSection({ changes }: { changes: FimChange[] }) {
  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>recent file integrity events</SectionLabel>
        <span className="text-[11px] text-fg-subtle">
          last {changes.length} change{changes.length === 1 ? "" : "s"}
        </span>
      </div>
      <DataPanel className="overflow-hidden">
        {changes.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-fg-muted">
            No file integrity events for this instance yet.
          </div>
        ) : (
          <FimChangesTable changes={changes} scope="host" />
        )}
      </DataPanel>
    </section>
  );
}

// =========================================================================
// Configuration / customization help
// =========================================================================

function ConfigurationHelpSection({ instanceId: _instanceId }: { instanceId: string }) {
  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>configuration</SectionLabel>
        <span className="text-[11px] text-fg-subtle">
          live edit coming soon · today: env vars on the host
        </span>
      </div>
      <DataPanel className="space-y-3 px-4 py-4 text-xs text-fg-muted">
        <p className="text-fg">
          To add or remove monitored paths on this host today, edit the
          systemd unit&apos;s environment and restart the agent. Push-from-UI
          customization is planned for Phase 2 (SSM Parameter Store).
        </p>
        <div className="space-y-1 rounded border border-line-soft bg-surface-2 p-3 font-mono text-[11px]">
          <div className="text-fg-subtle">
            # on the host (root):
          </div>
          <div>sudo systemctl edit blackwatch-agent</div>
          <div className="text-fg-subtle"># add to [Service]:</div>
          <div>
            Environment=BLACKWATCH_FIM_EXTRA_FILES=/etc/redis/redis.conf,/etc/postgresql/postgresql.conf
          </div>
          <div>
            Environment=BLACKWATCH_FIM_EXTRA_DIRS=/etc/nginx,/etc/letsencrypt
          </div>
          <div className="text-fg-subtle"># then:</div>
          <div>sudo systemctl restart blackwatch-agent</div>
        </div>
        <p>
          Within ~15 seconds (first scan) the new paths appear in the
          &quot;Monitored paths&quot; table above with their file counts.
          Use the path summary above to verify the agent picked up your
          additions.
        </p>
      </DataPanel>
    </section>
  );
}

// =========================================================================
// helpers
// =========================================================================

function humanAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
