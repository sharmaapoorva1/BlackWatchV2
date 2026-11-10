import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

import { fetchHostDetail, hostLabel } from "@/lib/api";
import { HostDisplayNameEditor } from "@/components/domain/HostDisplayNameEditor";
import { HostMetricsChart } from "@/components/domain/HostMetricsChart";
import { HostInventoryTable, type HostInventoryRow } from "@/components/domain/HostInventoryTable";
import type {
  HostRecord,
  HostDetailResponse,
  HostSnapshots,
  HostSession,
  EventEnvelope,
  FimCoverage,
  FimChange,
  FimConfiguredPaths,
  AgentDeliveryStatus,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailLayout } from "@/components/layout/DetailLayout";
import { StickyHeader } from "@/components/layout/StickyHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Section, AutoGrid } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import type { NavGroup } from "@/components/layout/SectionNav";
import { DataPanel } from "@/components/layout/DataPanel";
import { HostRecentActivityTable, HostSessionsTable, type HostActivityItem } from "@/components/domain/HostDetailTables";
import { EventsDataTable } from "@/components/domain/EventsDataTable";
import { FimChangesTable } from "@/components/domain/FimTables";
import { toEventTableRow } from "@/lib/event-summary";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { KeyValueRow } from "@/components/layout/KeyValueRow";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  SeverityBadge,
  severityBorderBg,
} from "@/components/domain/SeverityBadge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Host · ${decodeURIComponent(id)}` };
}

export default async function HostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchHostDetail(id);
  const { host } = data;

  return (
    <>
      {host ? (
        <HostHeaderBar id={id} data={data} />
      ) : (
        <>
          <PageHeader
            title={id}
            subtitle="no hostname reported"
            breadcrumbs={[{ label: "Hosts", href: "/hosts" }, { label: id }]}
          />
          <DataPanel className="px-6 py-12 text-center text-sm text-fg-muted">
            No data for instance{" "}
            <code className="font-mono text-fg">{id}</code> yet. Has the agent
            ever reported?
          </DataPanel>
        </>
      )}

      {host && <HostBody data={data} />}
    </>
  );
}

// =========================================================================
// header: who this page is about. Pinned at the top while the sections scroll.
// =========================================================================

/** Addresses the host is bound to, from its listening sockets. The agent does
 *  not report a primary IP, so wildcard, loopback and link-local binds are
 *  dropped and what is left is the best available evidence of its address. */
function boundAddresses(ports: NonNullable<HostSnapshots["ports"]>): string[] {
  const skip = (address: string) =>
    ["0.0.0.0", "::", "*", "[::]", "::1", "[::1]"].includes(address) ||
    address.startsWith("127.") ||
    address.startsWith("169.254.") ||
    address.toLowerCase().startsWith("fe80") ||
    address.toLowerCase().startsWith("::ffff:127.");
  return [...new Set(ports.map((port) => port.address.replace(/%.*$/, "")).filter((address) => address && !skip(address)))];
}

function HeaderFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
      <span className="text-fg-subtle">{label}</span>
      {children}
    </span>
  );
}

function HostHeaderBar({ id, data }: { id: string; data: HostDetailResponse }) {
  const { host, snapshots, age_seconds, stale, health_state } = data;
  if (!host) return null;
  const extra = host.extra ?? {};
  const name = hostLabel({ ...host, instance_id: id });
  const state = health_state ?? (host.active && !stale ? "healthy" : "silent");
  const tone =
    state === "healthy"
      ? { dot: "bg-sev-resolved", text: "text-sev-resolved" }
      : ["delivery_delayed", "processing_delayed", "collector_degraded"].includes(state)
        ? { dot: "bg-sev-medium", text: "text-sev-medium" }
        : { dot: "bg-sev-critical", text: "text-sev-critical" };
  const addresses = boundAddresses(snapshots.ports ?? []);
  const tags = extra.tags ?? {};

  return (
    <StickyHeader>
      <Breadcrumbs items={[{ label: "Hosts", href: "/hosts" }, { label: name }]} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
        <h1 className="break-words font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">{name}</h1>
        <span className={clsx("inline-flex items-center gap-1.5 text-xs", tone.text)}>
          <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", tone.dot)} />
          {state.replaceAll("_", " ")}
          <span className="text-fg-subtle">
            · {age_seconds == null ? "no report yet" : `reported ${formatAge(age_seconds)} ago`}
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
        <HeaderFact label="Instance">
          <span className="flex items-center">
            <code className="font-mono text-fg">{id}</code>
            <CopyButton value={id} label="Copy instance ID" />
          </span>
        </HeaderFact>
        {host.hostname && host.hostname !== name && (
          <HeaderFact label="Host">
            <code className="break-all font-mono text-fg-muted">{host.hostname}</code>
          </HeaderFact>
        )}
        {addresses.length > 0 && (
          <HeaderFact label={addresses.length === 1 ? "Address" : "Addresses"}>
            <span className="flex flex-wrap items-center gap-x-3">
              {addresses.slice(0, 3).map((address) => (
                <IpCell key={address} value={address} className="text-xs text-fg" />
              ))}
              {addresses.length > 3 && <span className="text-fg-subtle">+{addresses.length - 3}</span>}
            </span>
          </HeaderFact>
        )}
        {(tags.env || tags.role) && (
          <HeaderFact label="Tags">
            <span className="flex items-center gap-1.5">
              {tags.env && <code className="rounded border border-line-soft bg-surface-2 px-1.5 py-0.5 font-mono text-fg-muted">env={tags.env}</code>}
              {tags.role && <code className="rounded border border-line-soft bg-surface-2 px-1.5 py-0.5 font-mono text-fg-muted">role={tags.role}</code>}
            </span>
          </HeaderFact>
        )}
        {host.region && (
          <HeaderFact label="Region">
            <span className="font-mono text-fg-muted">{host.region}</span>
          </HeaderFact>
        )}
        {host.account && (
          <HeaderFact label="Account">
            <span className="font-mono text-fg-muted">{host.account}</span>
          </HeaderFact>
        )}
        {(extra.agent_version || extra.uptime_seconds != null) && (
          <HeaderFact label="Agent">
            <span className="font-mono text-fg-muted">
              {[extra.agent_version ? `v${extra.agent_version}` : null, extra.uptime_seconds != null ? `up ${humanAge(extra.uptime_seconds)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </HeaderFact>
        )}
      </div>
    </StickyHeader>
  );
}

// =========================================================================
// body: a table of contents on the left, sections of collapsible blocks on
// the right. Blocks that have no data are simply not rendered (or listed).
// =========================================================================

type Block = {
  id: string;
  title: string;
  count?: number;
  summary?: ReactNode;
  defaultOpen?: boolean;
  node: ReactNode;
};
type BlockGroup = { id: string; title: string; description: string; blocks: Block[] };

/** Short lists start open; long inventories start closed so you can scroll past. */
const isShort = (count: number) => count <= 12;

function HostBody({ data }: { data: HostDetailResponse }) {
  const {
    host, snapshots, age_seconds, stale,
    health_state, health_reason, delivery,
    auth_events, state_changes, alerts,
    fim_coverage, fim_recent_changes,
  } = data;
  if (!host) return null;

  const systemd = snapshots?.systemd_units;
  const enabledUnits = Array.isArray(systemd) ? systemd : systemd?.enabled ?? [];
  const activeUnits = Array.isArray(systemd) ? [] : systemd?.active ?? [];
  const runningUnits = Array.isArray(systemd) ? [] : systemd?.running ?? [];
  const packageDetails = new Map((snapshots.package_details ?? []).map((item) => [item.name, item]));

  const sessions = host.extra?.active_sessions ?? [];
  const users = snapshots.users ?? [];
  const keys = snapshots.authorized_keys ?? [];
  const sudoers = snapshots.sudoers ?? {};
  const critical = snapshots.critical_files ?? {};
  const cron = snapshots.cron ?? {};
  const suid = snapshots.suid ?? [];
  const modules = snapshots.kernel_modules ?? [];
  const ports = snapshots.ports ?? [];
  const processes = snapshots.processes ?? [];
  const disk = snapshots.disk ?? [];
  const packages = snapshots.packages ?? [];
  const entries = (record: Record<string, string>) => Object.keys(record).length;

  const keep = (...items: (Block | false)[]): Block[] => items.filter((item): item is Block => item !== false);

  const groups: BlockGroup[] = [
    {
      id: "access",
      title: "Access and identity",
      description: "Who can log in, who has, and what privileges they hold.",
      blocks: keep(
        sessions.length > 0 && { id: "host-sessions", title: "Current sessions", count: sessions.length, node: <SessionsSection sessions={sessions} /> },
        auth_events.length > 0 && { id: "host-auth-events", title: "SSH and sudo activity", count: auth_events.length, node: <EventsSection title="SSH and sudo activity" events={auth_events} /> },
        users.length > 0 && { id: "host-users", title: "Users", count: users.length, defaultOpen: isShort(users.length), node: <UsersSection rows={users} /> },
        keys.length > 0 && { id: "host-authorized-keys", title: "Authorized SSH keys", count: keys.length, defaultOpen: isShort(keys.length), node: <AuthorizedKeysSection rows={keys} /> },
        entries(sudoers) > 0 && { id: "host-sudoers", title: "Sudo policy files", count: entries(sudoers), defaultOpen: false, summary: "SHA-256", node: <FileHashSection title="Sudo policy files · SHA-256" data={sudoers} /> },
      ),
    },
    {
      id: "integrity",
      title: "Integrity and persistence",
      description: "File changes, monitored scope, system configuration and persistence surfaces.",
      blocks: keep(
        (fim_coverage !== null || fim_recent_changes.length > 0) && {
          id: "host-fim",
          title: "File integrity",
          count: fim_recent_changes.length,
          summary: fimModeSummary(fim_coverage),
          node: <FimSection coverage={fim_coverage} changes={fim_recent_changes} />,
        },
        state_changes.length > 0 && { id: "host-config-changes", title: "Configuration and inventory changes", count: state_changes.length, defaultOpen: isShort(state_changes.length), node: <EventsSection title="Host configuration and inventory changes" events={state_changes} /> },
        entries(critical) > 0 && { id: "host-critical-files", title: "Critical file hashes", count: entries(critical), defaultOpen: false, summary: "FIM baseline", node: <FileHashSection title="Critical file hashes · FIM" data={critical} /> },
        entries(cron) > 0 && { id: "host-cron", title: "Cron files", count: entries(cron), defaultOpen: false, summary: "SHA-256", node: <FileHashSection title="Cron file hashes" data={cron} /> },
        enabledUnits.length > 0 && { id: "host-enabled-units", title: "Enabled systemd units", count: enabledUnits.length, defaultOpen: false, node: <ScrollableList title="Enabled systemd units" items={enabledUnits} /> },
        activeUnits.length > 0 && { id: "host-active-units", title: "Active services and timers", count: activeUnits.length, defaultOpen: false, node: <ScrollableList title="Active services and timers" items={activeUnits} /> },
        runningUnits.length > 0 && { id: "host-running-units", title: "Running services", count: runningUnits.length, defaultOpen: false, node: <ScrollableList title="Running services" items={runningUnits} /> },
        suid.length > 0 && { id: "host-suid", title: "SUID binaries", count: suid.length, defaultOpen: false, node: <ScrollableList title="SUID binaries" items={suid} /> },
        modules.length > 0 && { id: "host-modules", title: "Kernel modules", count: modules.length, defaultOpen: false, summary: "inventory, not a rootkit verdict", node: <ScrollableList title="Kernel modules" items={modules} /> },
      ),
    },
    {
      id: "runtime",
      title: "Runtime and network",
      description: "What is listening and what is running right now.",
      blocks: keep(
        { id: "host-ports", title: "Listening ports", count: ports.length, node: <PortsSection rows={ports} /> },
        processes.length > 0 && { id: "host-processes", title: "Running processes", count: processes.length, defaultOpen: false, node: <ProcessesSection rows={processes} /> },
      ),
    },
    {
      id: "capacity",
      title: "Capacity and software",
      description: "Storage pressure and the supporting package inventory.",
      blocks: keep(
        disk.length > 0 && { id: "host-disk", title: "Disk usage", count: disk.length, node: <DiskSection rows={disk} /> },
        packages.length > 0 && {
          id: "host-packages",
          title: "Installed packages",
          count: packages.length,
          defaultOpen: false,
          summary: "context only, not vulnerability or signature verification",
          node: (
            <ScrollableList
              title="Installed packages"
              items={packages.map((name) => {
                const detail = packageDetails.get(name);
                return detail
                  ? `${name} · ${detail.version}${detail.installed_at ? ` · installed ${new Date(detail.installed_at).toLocaleDateString()}` : ""}`
                  : name;
              })}
            />
          ),
        },
      ),
    },
    {
      id: "agent-delivery",
      title: "Agent and delivery",
      description: "Agent identity, collection health and report delivery diagnostics.",
      blocks: [
        { id: "host-identity", title: "Host identity", node: <HostIdentityPanel host={host} /> },
        { id: "host-collectors", title: "Collector health", node: <HostCollectorPanel host={host} /> },
        { id: "host-delivery", title: "Report delivery", node: <HostDeliveryPanel delivery={delivery} /> },
      ],
    },
  ];

  const visible = groups.filter((group) => group.blocks.length > 0);
  const nav: NavGroup[] = [
    { id: "overview", label: "Overview" },
    ...visible.map((group) => ({
      id: group.id,
      label: group.title,
      items: group.blocks.map((block) => ({ id: block.id, label: block.title, count: block.count })),
    })),
  ];

  return (
    <DetailLayout nav={nav}>
      <Section id="overview" title="Overview" description="Health, what needs attention, and resource trends.">
        <AutoGrid min="26rem" gap="lg">
          <StatusSection
            host={host}
            ageSeconds={age_seconds}
            stale={stale}
            healthState={health_state}
            healthReason={health_reason}
          />
          <HostActivitySection
            alerts={alerts}
            authEvents={auth_events}
            stateChanges={state_changes}
            fimChanges={fim_recent_changes}
          />
        </AutoGrid>
        <HostMetricsChart instanceId={host.instance_id} />
      </Section>

      {visible.map((group) => (
        <Section key={group.id} id={group.id} title={group.title} description={group.description}>
          {group.blocks.map((block) => (
            <Subsection
              key={block.id}
              id={block.id}
              title={block.title}
              count={block.count}
              summary={block.summary}
              defaultOpen={block.defaultOpen ?? true}
            >
              {block.node}
            </Subsection>
          ))}
        </Section>
      ))}

      <p className="max-w-3xl text-xs leading-relaxed text-fg-subtle">
        BlackWatch shows the telemetry currently collected from this host. It does not provide full outbound
        network-flow history, process ancestry, memory capture, or executable signature verification.
      </p>
    </DetailLayout>
  );
}

// =========================================================================
// status
// =========================================================================

function HostIdentityPanel({ host }: { host: HostRecord }) {
  const extra = host.extra ?? {};
  return (
  <DataPanel className="px-4 py-2">
    <dl className="divide-y divide-line-soft">
      <KeyValueRow label="Display name"><HostDisplayNameEditor instanceId={host.instance_id} initial={host.display_name ?? null} /></KeyValueRow>
      <KeyValueRow label="Hostname"><span className="font-mono text-xs text-fg">{host.hostname ?? "—"}</span></KeyValueRow>
      <KeyValueRow label="Instance ID"><span className="break-all font-mono text-xs text-fg-muted">{host.instance_id}</span></KeyValueRow>
      <KeyValueRow label="Account / region"><span className="font-mono text-xs text-fg-muted">{[host.account, host.region].filter(Boolean).join(" · ") || "—"}</span></KeyValueRow>
      {extra.uptime_seconds != null && <KeyValueRow label="Uptime"><span className="font-mono text-xs text-fg-muted">{humanAge(extra.uptime_seconds)}</span></KeyValueRow>}
      {extra.agent_version && <KeyValueRow label="Agent version"><span className="font-mono text-xs text-fg-muted">{extra.agent_version}</span></KeyValueRow>}
      {extra.tick_duration_ms != null && <KeyValueRow label="Last collection tick"><span className="font-mono text-xs text-fg-muted">{extra.tick_duration_ms}ms</span></KeyValueRow>}
      {extra.tags && Object.keys(extra.tags).length > 0 && <KeyValueRow label="Tags"><div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">{Object.entries(extra.tags).map(([key, value]) => <code key={key} className="text-fg-muted">{key}={value}</code>)}</div></KeyValueRow>}
      {extra.rpm_db_corrupted && <KeyValueRow label="Package DB"><div className="text-xs text-sev-critical">RPM database reports {extra.rpm_db_corrupted.lock_count} lock file(s). Investigate package database health on the host.</div></KeyValueRow>}
    </dl>
  </DataPanel>
  );
}

function HostCollectorPanel({ host }: { host: HostRecord }) {
  const extra = host.extra ?? {};
  const statuses = extra.collector_status ?? {};
  const errors = extra.collector_errors ?? {};
  const stalled = extra.stalled_collectors ?? [];
  return (
  <DataPanel className="px-4 py-3">
    <CollectorHealthSummary statuses={statuses} errors={errors} stalled={stalled} />
  </DataPanel>
  );
}

function HostDeliveryPanel({ delivery }: { delivery?: AgentDeliveryStatus }) {
  return (
    <DataPanel className="px-4 py-2">
      {delivery ? (
        <dl className="divide-y divide-line-soft">
          <KeyValueRow label="Transport / rollout"><span className="font-mono text-xs text-fg-muted">{delivery.transport ?? "unknown"}{delivery.rollout ? ` · ${delivery.rollout}` : ""}</span></KeyValueRow>
          <KeyValueRow label="Last sequence / reported gaps"><span className="font-mono text-xs text-fg-muted">{delivery.last_sequence ?? "—"}{delivery.sequence_gaps > 0 ? ` · ${delivery.sequence_gaps} reported gap(s)` : ""}{delivery.sequence_tracking_overflow ? " · tracking limit exceeded" : ""}</span></KeyValueRow>
          <KeyValueRow label="Queue / processing delay"><span className="font-mono text-xs text-fg-muted">queue {delivery.queue_delay_seconds == null ? "—" : `${Math.round(delivery.queue_delay_seconds)}s`} · processing {delivery.processing_delay_seconds == null ? "—" : `${Math.round(delivery.processing_delay_seconds)}s`}</span></KeyValueRow>
          <KeyValueRow label="Last accepted / processed"><span className="font-mono text-xs text-fg-muted">{delivery.last_accepted_at ? new Date(delivery.last_accepted_at).toLocaleString() : "—"} · {delivery.last_processed_at ? new Date(delivery.last_processed_at).toLocaleString() : "—"}</span></KeyValueRow>
          {delivery.last_error && <KeyValueRow label="Delivery error"><span className="break-words text-xs text-sev-critical">{delivery.last_error}</span></KeyValueRow>}
        </dl>
      ) : <p className="text-sm text-fg-muted">No delivery diagnostics reported.</p>}
    </DataPanel>
  );
}

function StatusSection({
  host,
  ageSeconds,
  stale,
  healthState,
  healthReason,
}: {
  host: HostRecord;
  ageSeconds: number | null;
  stale: boolean;
  healthState?: string;
  healthReason?: string;
}) {
  const extra = host.extra ?? {};
  const state = healthState ?? (host.active && !stale ? "healthy" : "silent");
  const reporting = state === "healthy";
  const warning = ["delivery_delayed", "processing_delayed", "collector_degraded"].includes(state);
  const memory = extra.memory;
  const cpu = extra.cpu;
  const cpuAnomaly = extra._state?.cpu_anomaly_active === true;
  const baselineN = extra._baseline_cpu?.n ?? 0;
  const collectorStatuses = extra.collector_status ?? {};
  const collectorErrors = extra.collector_errors ?? {};
  const stalledCollectors = extra.stalled_collectors ?? [];

  return (
    <section className="space-y-2">
      <SectionLabel as="h3">status</SectionLabel>
      <DataPanel className="space-y-1 px-4 py-3">
        <dl className="divide-y divide-line-soft">
          <KeyValueRow label="Agent">
            <span className="inline-flex items-center gap-2" title={healthReason}>
              <span aria-hidden className={clsx(
                "h-1.5 w-1.5 rounded-full",
                reporting ? "bg-sev-resolved" : warning ? "bg-sev-medium" : "bg-sev-critical",
              )} />
              <span className={clsx(reporting ? "text-fg" : warning ? "text-sev-medium" : "text-sev-critical")}>
                {state.replaceAll("_", " ")}
              </span>
            </span>
          </KeyValueRow>
          <KeyValueRow label="Last seen">
            {ageSeconds === null ? (
              <span className="text-fg-disabled">—</span>
            ) : (
              <span className="font-mono text-xs">
                <span className="text-fg-muted">{formatAge(ageSeconds)} ago</span>
                {stale && <span className="ml-2 text-xs text-sev-medium">stale</span>}
              </span>
            )}
          </KeyValueRow>
          {!reporting && healthReason && (
            <KeyValueRow label="Health detail">
              <span className="break-words text-xs text-fg-muted">{healthReason}</span>
            </KeyValueRow>
          )}
          {memory && memory.used_pct != null && (
            <KeyValueRow label="Memory · latest report">
              <span className="inline-flex items-baseline gap-2">
                <span className={clsx("font-mono", memoryColor(memory.used_pct))}>{memory.used_pct}%</span>
                <span className="text-xs text-fg-subtle">· {kbToMib(memory.used_kb)} / {kbToMib(memory.total_kb)} MiB</span>
              </span>
            </KeyValueRow>
          )}
          {cpu && (
            <KeyValueRow label="CPU % · latest report">
              <div className="space-y-1">
                <div className="font-mono text-xs">
                  {cpu.utilization_pct != null ? (
                    <>
                      <span className={clsx("text-sm", memoryColor(cpu.utilization_pct))}>{cpu.utilization_pct}%</span>
                      <span className="text-fg-subtle"> · {cpu.cpu_count} CPUs · load {cpu.load_1min} (1m) / {cpu.load_5min} (5m)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-fg-subtle">Not reported by this agent · </span>
                      <span className="text-fg">{cpu.load_1min}</span>
                      <span className="text-fg-subtle"> (1m) · </span>
                      <span className="text-fg">{cpu.load_5min}</span>
                      <span className="text-fg-subtle"> (5m) · {cpu.cpu_count} CPUs</span>
                    </>
                  )}
                </div>
                {cpuAnomaly && <div className="inline-flex items-center gap-1.5 text-xs text-sev-critical"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sev-critical" />anomaly active</div>}
                {!cpuAnomaly && baselineN >= 60 && extra._baseline_cpu && (
                  <div className="text-xs text-fg-subtle">load baseline mean {extra._baseline_cpu.mean.toFixed(3)} ({baselineN} samples)</div>
                )}
              </div>
            </KeyValueRow>
          )}
          {(Object.keys(collectorStatuses).length > 0 || Object.keys(collectorErrors).length > 0 || stalledCollectors.length > 0) && (
            <KeyValueRow label="Collector coverage">
              <CollectorHealthSummary statuses={collectorStatuses} errors={collectorErrors} stalled={stalledCollectors} compact />
            </KeyValueRow>
          )}
        </dl>
      </DataPanel>
    </section>
  );
}

function formatAge(seconds: number): string {
  const age = Math.max(0, Math.floor(seconds));
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.floor(age / 60)}m`;
  if (age < 86400) return `${Math.floor(age / 3600)}h`;
  return `${Math.floor(age / 86400)}d`;
}
function HostActivitySection({
  alerts,
  authEvents,
  stateChanges,
  fimChanges,
}: {
  alerts: EventEnvelope[];
  authEvents: EventEnvelope[];
  stateChanges: EventEnvelope[];
  fimChanges: FimChange[];
}) {
  const byId = new Map<string, HostActivityItem>();
  for (const event of [...authEvents, ...stateChanges]) {
    const action = event.action ?? "host activity";
    const kind = action.startsWith("host.auth.")
      ? "Access"
      : action.startsWith("host.sudo.")
        ? "Privilege"
        : action.startsWith("host.packages.")
          ? "Package change"
          : action.startsWith("host.")
            ? "Host change"
            : event.category ?? "Alert";
    byId.set(event.event_id, {
      key: event.event_id,
      at: event.event_time,
      kind,
      severity: event.severity ?? null,
      action,
      actorOrTarget: event.actor?.principal
        ?? event.target?.name
        ?? event.target?.id
        ?? "—",
      href: `/events/${event.event_id}`,
    });
  }
  for (const change of fimChanges) {
    const key = change.event_id ?? `fim:${change.path}:${change.changed_at ?? "unknown"}`;
    if (byId.has(key)) continue;
    byId.set(key, {
      key,
      at: change.changed_at ?? "",
      kind: "File integrity",
      severity: null,
      action: `${change.change_type.replaceAll("_", " ")} · ${change.path}`,
      actorOrTarget: change.actor_comm
        ? `${change.actor_comm}${change.actor_uid == null ? "" : ` · uid ${change.actor_uid}`}`
        : "unknown · no attribution",
      href: change.event_id ? `/events/${change.event_id}` : null,
    });
  }
  const activity = [...byId.values()]
    .sort((a, b) => {
      const timeA = Date.parse(a.at);
      const timeB = Date.parse(b.at);
      return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
    })
    .slice(0, 12);

  const priorityAlerts = [...alerts]
    .filter((event) => ["critical", "high"].includes(String(event.severity).toLowerCase()))
    .sort((a, b) => {
      const priority = (value: string | null | undefined) => value?.toLowerCase() === "critical" ? 0 : 1;
      return priority(a.severity) - priority(b.severity) || Date.parse(b.event_time) - Date.parse(a.event_time);
    })
    .slice(0, 5);

  return (
    <section className="min-w-0 space-y-5" aria-labelledby="host-activity-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 id="host-activity-title" className="text-sm font-semibold text-fg">Needs attention</h3>
          <p className="mt-1 text-xs text-fg-muted">High and critical alerts, followed by the latest host activity.</p>
        </div>
        <Link href="/events" className="text-xs text-signal hover:underline">All events</Link>
      </div>
      <DataPanel scrollX>
        {priorityAlerts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-fg-muted">No high or critical host alerts.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {priorityAlerts.map((alert) => (
              <li key={alert.event_id} className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                <SeverityBadge severity={alert.severity as string} />
                <div className="min-w-0 flex-1">
                  <Link href={`/events/${alert.event_id}`} className="break-words font-mono text-xs text-fg hover:text-signal">{alert.action ?? alert.category ?? "Security alert"}</Link>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-fg-subtle">
                    <span>{alert.actor?.principal ?? alert.target?.name ?? "Unattributed"}</span>
                    <TimestampCell value={alert.event_time} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DataPanel>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-fg">Recent activity</h4>
          <p className="mt-1 text-xs text-fg-muted">Access, privilege, integrity, and host changes · newest first.</p>
        </div>
        <span className="text-xs text-fg-subtle">{activity.length} entries</span>
      </div>
      <DataPanel scrollX>
        {activity.length === 0 ? (
          <div className="px-4 py-6 text-sm text-fg-muted">No recent host alerts or changes.</div>
        ) : (
          <HostRecentActivityTable items={activity} />
        )}
      </DataPanel>
    </section>
  );
}

type CollectorHealth = {
  state: string;
  interval_seconds: number;
  last_attempt_at: string | null;
  last_success_at: string | null;
  age_seconds: number | null;
  error: string | null;
};

function CollectorHealthSummary({
  statuses,
  errors,
  stalled,
  compact = false,
}: {
  statuses: Record<string, CollectorHealth>;
  errors: Record<string, string>;
  stalled: string[];
  compact?: boolean;
}) {
  const names = [...new Set([
    ...Object.keys(statuses),
    ...Object.keys(errors),
    ...stalled,
  ])].sort();
  const failed = names.filter((name) =>
    statuses[name]?.state === "error" || Boolean(statuses[name]?.error) || Boolean(errors[name]),
  );
  const failedSet = new Set(failed);
  const stale = names.filter((name) =>
    !failedSet.has(name) && (statuses[name]?.state === "stale" || stalled.includes(name)),
  );
  const staleSet = new Set(stale);
  const pending = names.filter((name) =>
    !failedSet.has(name) && !staleSet.has(name) && statuses[name]?.state === "pending",
  );
  const pendingSet = new Set(pending);
  const current = names.filter((name) =>
    !failedSet.has(name) && !staleSet.has(name) && !pendingSet.has(name),
  );
  const needsAttention = failed.length > 0 || stale.length > 0;

  const summary = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <span className={current.length > 0 && !needsAttention ? "text-sev-resolved" : "text-fg-muted"}>{current.length} current</span>
      {stale.length > 0 && <span className="text-sev-medium">{stale.length} stale</span>}
      {failed.length > 0 && <span className="text-sev-critical">{failed.length} failed</span>}
      {pending.length > 0 && <span className="text-fg-subtle">{pending.length} pending</span>}
      {names.length === 0 && <span className="text-fg-subtle">No collector status reported</span>}
    </div>
  );
  if (compact) return <a href="#agent-delivery" className="inline-block hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">{summary}</a>;

  return (
    <div className="space-y-3">
      {summary}
      {names.length > 0 && <div className="grid gap-x-6 sm:grid-cols-2">
        {names.map((name) => {
          const status = statuses[name];
          const error = status?.error ?? errors[name];
          const state = failedSet.has(name) ? "failed" : staleSet.has(name) ? "stale" : status?.state ?? "unknown";
          return (
            <div key={name} className="min-w-0 border-t border-line-soft py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="break-all font-mono text-xs text-fg">{name}</span>
                <span className={state === "ok" ? "text-xs text-sev-resolved" : state === "failed" ? "text-xs text-sev-critical" : state === "stale" ? "text-xs text-sev-medium" : "text-xs text-fg-subtle"}>{state}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-fg-subtle">
                <span>last success {status?.age_seconds == null ? "never" : `${status.age_seconds}s ago`}</span>
                {status && <span>every {status.interval_seconds}s</span>}
                {status?.last_attempt_at && <span>last attempt {new Date(status.last_attempt_at).toLocaleString()}</span>}
              </div>
              {error && <div className="mt-1 break-words text-xs text-sev-critical">{error}</div>}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// =========================================================================
// sessions
// =========================================================================

function SessionsSection({ sessions }: { sessions: HostSession[] }) {
  return (
    <DataPanel className="overflow-hidden">
        <HostSessionsTable sessions={sessions} />
      </DataPanel>
  );
}

// =========================================================================
// File Integrity Monitoring (FIM)  — Part 1: periodic baseline
// =========================================================================

/** One-line description of how FIM is collecting on this host. */
function fimModeSummary(coverage: FimCoverage | null): string {
  const realtime = coverage?.inotify_active ?? false;
  const whodata = coverage?.auditd_active ?? false;
  if (realtime && whodata) return "real-time · inotify + auditd whodata + 6h baseline scan";
  if (realtime) return "real-time · inotify + 6h baseline scan (whodata off)";
  return "periodic baseline · 6h scan (inotify inactive)";
}

function FimSection({
  coverage,
  changes,
}: {
  coverage: FimCoverage | null;
  changes: FimChange[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <FimCoverageCard coverage={coverage} />

      <DataPanel className="overflow-hidden">
        {changes.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-fg-muted">
            No file integrity changes recorded. The agent will start emitting
            events once it detects drift from the established baseline.
          </div>
        ) : (
          <FimChangesTable changes={changes} scope="host" detectionKey="detection_source" detectedLabel="Source" />
        )}
      </DataPanel>

      {coverage?.configured_paths && (
        <FimWatchedPaths paths={coverage.configured_paths} />
      )}
    </div>
  );
}

function FimWatchedPaths({ paths }: { paths: FimConfiguredPaths }) {
  return (
    <DataPanel className="space-y-3 px-4 py-3 text-xs">
      <div className="text-xs text-fg-subtle">
        watched paths · what FIM is monitoring on this host
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PathColumn label="Critical files" paths={paths.critical_files} />
        <PathColumn label="Critical directories" paths={paths.critical_dirs} />
        <PathColumn label="Binary directories" paths={paths.binary_dirs} />
      </div>
      <div className="border-t border-line-soft pt-2 text-xs text-fg-subtle">
        Real-time (inotify): files + critical directories · Periodic (6h):
        everything · Auditd whodata: write &amp; attribute changes
      </div>
    </DataPanel>
  );
}

function PathColumn({
  label,
  paths,
}: {
  label: string;
  paths: string[];
}) {
  const rows: HostInventoryRow[] = paths.map((path) => ({ key: path, cells: [path] }));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between text-xs text-fg-subtle">
        {label} <span className="text-fg-disabled">({paths.length})</span>
      </div>
      <HostInventoryTable title={`${label} FIM paths`} columns={[{ label: "Path", mono: true }]} rows={rows} />
    </div>
  );
}

function FimCoverageCard({ coverage }: { coverage: FimCoverage | null }) {
  if (!coverage) {
    return (
      <DataPanel className="px-4 py-3 text-xs text-fg-muted">
        Coverage data not reported yet. Agent will report after its first scan
        (~15 seconds after start, then every 6 hours).
      </DataPanel>
    );
  }
  const lastScan = coverage.last_full_scan_at
    ? new Date(coverage.last_full_scan_at)
    : null;
  const lastScanAge = lastScan
    ? humanAge((Date.now() - lastScan.getTime()) / 1000)
    : "—";

  // Real-time + whodata indicators are the two things an auditor / SRE wants
  // to see at a glance: "is detection live?" and "do we know who changed it?"
  const realtime = coverage.inotify_active;
  const whodata = coverage.auditd_active;
  const realtimeValue = realtime
    ? `${coverage.inotify_watch_count} paths · sub-second`
    : "inactive";
  const whodataValue = whodata
    ? "auditd active · actor attribution on"
    : "inactive";

  return (
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
      <div className="border-t border-line-soft pt-2 text-xs text-fg-subtle">
        Paths configured: <span className="text-fg-muted normal-case">{coverage.paths_configured}</span>
        {coverage.paths_inotify > 0 && (
          <>
            {" · "}real-time scope:{" "}
            <span className="text-fg-muted normal-case">{coverage.paths_inotify}</span>
          </>
        )}
        {coverage.paths_baseline_only > 0 && (
          <>
            {" · "}baseline-only:{" "}
            <span className="text-fg-muted normal-case">{coverage.paths_baseline_only}</span>
          </>
        )}
      </div>
    </DataPanel>
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
      <div className="text-xs text-fg-subtle">
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

function humanAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// =========================================================================
// disk, ports, processes, users, keys
// =========================================================================

function DiskSection({
  rows,
}: {
  rows: NonNullable<HostSnapshots["disk"]>;
}) {
  const inventoryRows: HostInventoryRow[] = rows.map((disk) => ({
    key: disk.mount,
    cells: [
      disk.mount,
      disk.fs_type,
      `${disk.used_pct}%`,
      disk.inodes_used_pct == null ? "—" : `${disk.inodes_used_pct}%`,
      `${disk.used} / ${disk.total} KB`,
      [
        disk.bytes_sampled_at ? `bytes ${new Date(disk.bytes_sampled_at).toLocaleString()}` : "",
        disk.inodes_sampled_at ? `inodes ${new Date(disk.inodes_sampled_at).toLocaleString()}` : "",
      ].filter(Boolean).join(" · ") || "—",
    ],
  }));
  return (
    <DataPanel scrollX>
        <HostInventoryTable title="disk mounts" columns={[
          { label: "Mount", mono: true }, { label: "Filesystem", mono: true },
          { label: "Used" }, { label: "Inodes" }, { label: "Used / total", mono: true },
          { label: "Sampled", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
  );
}

function PortsSection({
  rows,
}: {
  rows: NonNullable<HostSnapshots["ports"]>;
}) {
  const inventoryRows: HostInventoryRow[] = rows.map((port, index) => ({
    key: `${port.proto}-${port.port}-${index}`,
    cells: [port.proto, port.address, String(port.port), port.process ?? "—"],
  }));
  return (
    <DataPanel scrollX>
        <HostInventoryTable title="listening ports" columns={[
          { label: "Protocol", mono: true }, { label: "Address", mono: true },
          { label: "Port", mono: true }, { label: "Process", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
  );
}

function ProcessesSection({
  rows,
}: {
  rows: NonNullable<HostSnapshots["processes"]>;
}) {
  const inventoryRows: HostInventoryRow[] = rows.map((process) => ({
    key: String(process.pid),
    cells: [process.user, String(process.pid), process.comm],
  }));
  return (
    <DataPanel scrollX>
        <HostInventoryTable title="running processes" columns={[
          { label: "User" }, { label: "PID", mono: true }, { label: "Command", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
  );
}

function UsersSection({
  rows,
}: {
  rows: NonNullable<HostSnapshots["users"]>;
}) {
  const inventoryRows: HostInventoryRow[] = rows.map((user) => ({
    key: user.name,
    cells: [
      user.name,
      String(user.uid),
      `${user.account_type ?? "unclassified"} · ${user.interactive == null ? "access unknown" : user.interactive ? "interactive" : "non-interactive"}${user.sudo_wheel_member ? " · sudo/wheel member" : ""} · account ${user.account_status ?? "unknown"} · password ${user.password_status ?? "unknown"}`,
      user.groups?.join(", ") || "—",
      user.shell,
    ],
  }));
  return (
    <DataPanel scrollX>
        <HostInventoryTable title="users and access" columns={[
          { label: "Name" }, { label: "UID", mono: true }, { label: "Class and access" },
          { label: "Groups", mono: true }, { label: "Shell", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
  );
}

function AuthorizedKeysSection({
  rows,
}: {
  rows: NonNullable<HostSnapshots["authorized_keys"]>;
}) {
  const inventoryRows: HostInventoryRow[] = rows.map((key, index) => ({
    key: `${key.user}-${key.fingerprint}-${index}`,
    cells: [key.user, key.fingerprint, key.preview],
  }));
  return (
    <DataPanel scrollX>
        <HostInventoryTable title="authorized SSH keys" columns={[
          { label: "User" }, { label: "Fingerprint", mono: true }, { label: "Key preview", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
  );
}

// =========================================================================
// generic file-hash table + scrollable mono list
// =========================================================================

function FileHashSection({
  title,
  data,
}: {
  title: string;
  data: Record<string, string>;
}) {
  const rows = Object.entries(data);
  const inventoryRows: HostInventoryRow[] = rows.map(([path, hash]) => ({
    key: path,
    cells: [path, hash],
  }));
  return (
    <DataPanel scrollX>
        <HostInventoryTable title={title} columns={[
          { label: "Path", mono: true }, { label: "SHA-256", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
  );
}

function ScrollableList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  const inventoryRows: HostInventoryRow[] = items.map((item, index) => ({
    key: `${index}-${item}`,
    cells: [item],
  }));
  return (
    <DataPanel scrollX>
        <HostInventoryTable title={title} columns={[{ label: "Value", mono: true }]} rows={inventoryRows} />
      </DataPanel>
  );
}

// =========================================================================
// generic events table (used twice: SSH/sudo + state changes)
// =========================================================================

function EventsSection({
  title,
  events,
}: {
  title: string;
  events: EventEnvelope[];
}) {
  return (
    <DataPanel className="overflow-hidden">
        <EventsDataTable
          events={events.map(toEventTableRow)}
          variant="compact"
          tableId={`host-events-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v2`}
          ariaLabel={title}
        />
      </DataPanel>
  );
}

// =========================================================================
// helpers
// =========================================================================

function memoryColor(pct: number): string {
  if (pct >= 95) return "text-sev-critical";
  if (pct >= 90) return "text-sev-medium";
  return "text-fg";
}

function kbToMib(kb: number | null | undefined): string {
  if (kb == null) return "—";
  return Math.round(kb / 1024).toString();
}
