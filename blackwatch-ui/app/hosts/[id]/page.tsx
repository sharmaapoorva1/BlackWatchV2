import Link from "next/link";
import clsx from "clsx";

import { fetchHostDetail, hostLabel } from "@/lib/api";
import { HostDisplayNameEditor } from "@/components/domain/HostDisplayNameEditor";
import { HostMetricsChart } from "@/components/domain/HostMetricsChart";
import { HostInventoryTable, type HostInventoryRow } from "@/components/domain/HostInventoryTable";
import type {
  HostRecord,
  HostSnapshots,
  HostSession,
  EventEnvelope,
  FimCoverage,
  FimChange,
  FimConfiguredPaths,
  AgentDeliveryStatus,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Table } from "@/components/ui/Table";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { KeyValueRow } from "@/components/layout/KeyValueRow";
import { Disclosure } from "@/components/ui/Disclosure";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import {
  SeverityBadge,
  severityBorderBg,
} from "@/components/domain/SeverityBadge";

export default async function HostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchHostDetail(id);
  const {
    host, snapshots, age_seconds, stale,
    health_state, health_reason, delivery,
    auth_events, state_changes, alerts,
    fim_coverage, fim_recent_changes,
  } = data;
  const systemd = snapshots?.systemd_units;
  const enabledSystemdUnits = Array.isArray(systemd) ? systemd : systemd?.enabled ?? [];
  const activeSystemdUnits = Array.isArray(systemd) ? [] : systemd?.active ?? [];
  const runningSystemdUnits = Array.isArray(systemd) ? [] : systemd?.running ?? [];
  const accessCount = auth_events.length
    + (host?.extra?.active_sessions?.length ?? 0)
    + (snapshots.users?.length ?? 0)
    + (snapshots.authorized_keys?.length ?? 0)
    + Object.keys(snapshots.sudoers ?? {}).length;
  const integrityCount = fim_recent_changes.length
    + state_changes.length
    + (fim_coverage?.files_tracked ?? 0)
    + (fim_coverage?.configured_paths
      ? fim_coverage.configured_paths.critical_files.length
        + fim_coverage.configured_paths.critical_dirs.length
        + fim_coverage.configured_paths.binary_dirs.length
      : 0)
    + Object.keys(snapshots.critical_files ?? {}).length
    + Object.keys(snapshots.cron ?? {}).length
    + enabledSystemdUnits.length
    + activeSystemdUnits.length
    + runningSystemdUnits.length
    + (snapshots.suid?.length ?? 0)
    + (snapshots.kernel_modules?.length ?? 0);
  const runtimeCount = (snapshots.ports?.length ?? 0) + (snapshots.processes?.length ?? 0);
  const capacityCount = (snapshots.disk?.length ?? 0) + (snapshots.packages?.length ?? 0);
  const packageDetails = new Map((snapshots.package_details ?? []).map((item) => [item.name, item]));

  return (
    <>
      <PageHeader
        title={host ? hostLabel({ ...host, instance_id: id }) : id}
        subtitle={
          host
            ? [host.hostname, id].filter(Boolean).join(" · ")
            : "no hostname reported"
        }
        breadcrumbs={[{ label: "Hosts", href: "/hosts" }, { label: host ? hostLabel({ ...host, instance_id: id }) : id }]}
      />

      {!host && (
        <DataPanel className="px-6 py-12 text-center text-sm text-fg-muted">
          No data for instance{" "}
          <code className="font-mono text-fg">{id}</code> yet. Has the agent
          ever reported?
        </DataPanel>
      )}

      {host && (
        <>
          <div className="mt-5 grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.6fr)]">
            <div className="order-2 min-w-0 space-y-5 xl:order-1">
              <StatusSection
                host={host}
                ageSeconds={age_seconds}
                stale={stale}
                healthState={health_state}
                healthReason={health_reason}
                delivery={delivery}
              />
              <HostMetricsChart instanceId={host.instance_id} />
            </div>
            <div className="order-1 min-w-0 xl:order-2">
              <HostActivitySection
                alerts={alerts}
                authEvents={auth_events}
                stateChanges={state_changes}
                fimChanges={fim_recent_changes}
              />
            </div>
          </div>

          <section className="mt-8 space-y-3" aria-label="Host evidence and inventories">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionLabel>host evidence</SectionLabel>
              <span className="text-[11px] text-fg-subtle">search and paginate within each inventory</span>
            </div>

            <div className="border border-line bg-surface-1 px-3 py-2">
              <Disclosure label={`Access and identity · ${accessCount} items`}>
                <div className="space-y-5 border-t border-line-soft px-1 pb-3 pt-1">
                {(host.extra?.active_sessions?.length ?? 0) > 0 && <SessionsSection sessions={host.extra!.active_sessions!} />}
                {auth_events.length > 0 && <EventsSection title="SSH and sudo history" events={auth_events} />}
                {(snapshots.users?.length ?? 0) > 0 && <UsersSection rows={snapshots.users!} />}
                {(snapshots.authorized_keys?.length ?? 0) > 0 && <AuthorizedKeysSection rows={snapshots.authorized_keys!} />}
                {snapshots.sudoers && Object.keys(snapshots.sudoers).length > 0 && <FileHashSection title="sudoers policy files" data={snapshots.sudoers} />}
                </div>
              </Disclosure>
            </div>

            <div className="border border-line bg-surface-1 px-3 py-2">
              <Disclosure label={`Integrity and persistence · ${integrityCount} items`}>
                <div className="space-y-5 border-t border-line-soft px-1 pb-3 pt-1">
                {(fim_coverage || fim_recent_changes.length > 0) && <FimSection coverage={fim_coverage} changes={fim_recent_changes} />}
                {state_changes.length > 0 && <EventsSection title="Host configuration and inventory changes" events={state_changes} />}
                {snapshots.critical_files && Object.keys(snapshots.critical_files).length > 0 && <FileHashSection title="critical file hashes · FIM" data={snapshots.critical_files} />}
                {snapshots.cron && Object.keys(snapshots.cron).length > 0 && <FileHashSection title="cron file hashes" data={snapshots.cron} />}
                {enabledSystemdUnits.length > 0 && <ScrollableList title="enabled systemd units" items={enabledSystemdUnits} />}
                {activeSystemdUnits.length > 0 && <ScrollableList title="active services and timers" items={activeSystemdUnits} />}
                {runningSystemdUnits.length > 0 && <ScrollableList title="running services" items={runningSystemdUnits} />}
                {(snapshots.suid?.length ?? 0) > 0 && <ScrollableList title="SUID binaries" items={snapshots.suid!} />}
                {(snapshots.kernel_modules?.length ?? 0) > 0 && <ScrollableList title="kernel modules · inventory only, not a rootkit verdict" items={snapshots.kernel_modules!} />}
                </div>
              </Disclosure>
            </div>

            <div className="border border-line bg-surface-1 px-3 py-2">
              <Disclosure label={`Runtime and network · ${runtimeCount} items`}>
                <div className="space-y-5 border-t border-line-soft px-1 pb-3 pt-1">
                <PortsSection rows={snapshots.ports ?? []} />
                {(snapshots.processes?.length ?? 0) > 0 && <ProcessesSection rows={snapshots.processes!} />}
                </div>
              </Disclosure>
            </div>

            <div className="border border-line bg-surface-1 px-3 py-2">
              <Disclosure label={`Capacity and software · ${capacityCount} items`}>
                <div className="space-y-5 border-t border-line-soft px-1 pb-3 pt-1">
                {(snapshots.disk?.length ?? 0) > 0 && <DiskSection rows={snapshots.disk!} />}
                {(snapshots.packages?.length ?? 0) > 0 && (
                  <ScrollableList
                    title={`Supporting package inventory · ${snapshots.packages!.length}; context only, not vulnerability or signature verification`}
                    items={snapshots.packages!.map((name) => {
                      const detail = packageDetails.get(name);
                      return detail
                        ? `${name} · ${detail.version}${detail.installed_at ? ` · installed ${new Date(detail.installed_at).toLocaleDateString()}` : ""}`
                        : name;
                    })}
                  />
                )}
                </div>
              </Disclosure>
            </div>

            <DataPanel className="px-4 py-3 text-[11px] leading-relaxed text-fg-subtle">
              This page presents the telemetry BlackWatch currently collects from this host. It does not provide full outbound network-flow history, process ancestry, memory capture, or executable signature verification.
            </DataPanel>
          </section>
        </>
      )}
    </>
  );
}

// =========================================================================
// status
// =========================================================================

function StatusSection({
  host,
  ageSeconds,
  stale,
  healthState,
  healthReason,
  delivery,
}: {
  host: HostRecord;
  ageSeconds: number | null;
  stale: boolean;
  healthState?: string;
  healthReason?: string;
  delivery?: AgentDeliveryStatus;
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
  const hasCollectorState = Object.keys(collectorStatuses).length > 0
    || Object.keys(collectorErrors).length > 0
    || stalledCollectors.length > 0;

  return (
    <section className="space-y-2">
      <SectionLabel>status</SectionLabel>
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
                <span className="text-fg-muted">{ageSeconds}s ago</span>
                {stale && <span className="ml-2 text-[10px] uppercase tracking-wider text-sev-medium">stale</span>}
              </span>
            )}
          </KeyValueRow>
          {memory && memory.used_pct != null && (
            <KeyValueRow label="Memory · latest report">
              <span className="inline-flex items-baseline gap-2">
                <span className={clsx("font-mono", memoryColor(memory.used_pct))}>{memory.used_pct}%</span>
                <span className="text-[11px] text-fg-subtle">· {kbToMib(memory.used_kb)} / {kbToMib(memory.total_kb)} MiB</span>
              </span>
            </KeyValueRow>
          )}
          {cpu && (
            <KeyValueRow label="CPU load · latest report">
              <div className="space-y-1">
                <div className="font-mono text-xs">
                  <span className="text-fg">{cpu.load_1min}</span>
                  <span className="text-fg-subtle"> (1m) · </span>
                  <span className="text-fg">{cpu.load_5min}</span>
                  <span className="text-fg-subtle"> (5m) · {cpu.cpu_count} CPUs · normalized {cpu.load_norm_1min}</span>
                </div>
                {cpuAnomaly && <div className="inline-flex items-center gap-1.5 text-xs text-sev-critical"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sev-critical" />anomaly active</div>}
                {!cpuAnomaly && baselineN >= 60 && extra._baseline_cpu && (
                  <div className="text-[11px] text-fg-subtle">baseline mean {extra._baseline_cpu.mean.toFixed(3)} ({baselineN} samples)</div>
                )}
              </div>
            </KeyValueRow>
          )}
          {hasCollectorState && (
            <KeyValueRow label="Collector coverage">
              <CollectorHealthSummary statuses={collectorStatuses} errors={collectorErrors} stalled={stalledCollectors} />
            </KeyValueRow>
          )}
        </dl>
        <Disclosure label="Host and delivery details" defaultOpen={Boolean(delivery?.last_error)}>
          <dl className="divide-y divide-line-soft border-t border-line-soft">
            <KeyValueRow label="Display name">
              <HostDisplayNameEditor instanceId={host.instance_id} initial={host.display_name ?? null} />
            </KeyValueRow>
            <KeyValueRow label="Hostname">
              <span className="font-mono text-xs text-fg">{host.hostname ?? "—"}</span>
            </KeyValueRow>
            <KeyValueRow label="Account / region">
              <span className="font-mono text-xs text-fg-muted">{[host.account, host.region].filter(Boolean).join(" · ") || "—"}</span>
            </KeyValueRow>
            {extra.uptime_seconds != null && (
              <KeyValueRow label="Uptime">
                <span className="font-mono text-xs text-fg-muted">{humanAge(extra.uptime_seconds)}</span>
              </KeyValueRow>
            )}
            {extra.agent_version && (
              <KeyValueRow label="Agent version">
                <span className="font-mono text-xs text-fg-muted">{extra.agent_version}</span>
              </KeyValueRow>
            )}
            {extra.tick_duration_ms != null && (
              <KeyValueRow label="Last collection tick">
                <span className="font-mono text-xs text-fg-muted">{extra.tick_duration_ms}ms</span>
              </KeyValueRow>
            )}
            {delivery && (
              <>
                <KeyValueRow label="Transport / rollout">
                  <span className="font-mono text-xs text-fg-muted">{delivery.transport ?? "unknown"}{delivery.rollout ? ` · ${delivery.rollout}` : ""}</span>
                </KeyValueRow>
                <KeyValueRow label="Sequence / gaps">
                  <span className="font-mono text-xs text-fg-muted">{delivery.last_sequence ?? "—"}{delivery.sequence_gaps > 0 ? ` · ${delivery.sequence_gaps} reported gap(s)` : ""}{delivery.sequence_tracking_overflow ? " · tracking limit exceeded" : ""}</span>
                </KeyValueRow>
                <KeyValueRow label="Queue / processing delay">
                  <span className="font-mono text-xs text-fg-muted">queue {delivery.queue_delay_seconds === null ? "—" : `${Math.round(delivery.queue_delay_seconds)}s`} · processing {delivery.processing_delay_seconds === null ? "—" : `${Math.round(delivery.processing_delay_seconds)}s`}</span>
                </KeyValueRow>
                <KeyValueRow label="Last accepted / processed">
                  <span className="font-mono text-xs text-fg-muted">{delivery.last_accepted_at ? new Date(delivery.last_accepted_at).toLocaleString() : "—"} · {delivery.last_processed_at ? new Date(delivery.last_processed_at).toLocaleString() : "—"}</span>
                </KeyValueRow>
                {delivery.last_error && (
                  <KeyValueRow label="Delivery error"><span className="text-xs text-sev-critical">{delivery.last_error}</span></KeyValueRow>
                )}
              </>
            )}
            {extra.rpm_db_corrupted && (
              <KeyValueRow label="Package DB">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sev-critical" />
                    <span className="text-sev-critical">CORRUPTED</span>
                    <span className="text-[11px] text-fg-subtle">· {extra.rpm_db_corrupted.lock_count} stale lock file(s)</span>
                  </div>
                  <div className="text-[11px] text-fg-subtle">Fix: <code className="text-fg">sudo rm -f /var/lib/rpm/__db.* &amp;&amp; sudo rpm --rebuilddb</code></div>
                </div>
              </KeyValueRow>
            )}
            {extra.tags && Object.keys(extra.tags).length > 0 && (
              <KeyValueRow label="Tags">
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                  {Object.entries(extra.tags).map(([key, value]) => <code key={key} className="text-fg-muted">{key}={value}</code>)}
                </div>
              </KeyValueRow>
            )}
          </dl>
        </Disclosure>
      </DataPanel>
    </section>
  );
}
type HostActivityItem = {
  key: string;
  at: string;
  kind: string;
  severity: string | null;
  action: string;
  actorOrTarget: string;
  href: string | null;
};

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
  for (const event of [...alerts, ...authEvents, ...stateChanges]) {
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
    .slice(0, 25);

  return (
    <section className="space-y-2" aria-labelledby="host-activity-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel>
          <span id="host-activity-title">overview · recent security activity</span>
        </SectionLabel>
        <span className="text-[11px] text-fg-subtle">newest first · full inventories below</span>
      </div>
      <DataPanel scrollX>
        {activity.length === 0 ? (
          <div className="px-4 py-6 text-sm text-fg-muted">No recent host alerts or changes.</div>
        ) : (
          <Table tableId="host-recent-activity" ariaLabel="Recent host security activity">
            <thead>
              <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                <th className="w-36 px-3 py-2 text-left font-normal">When</th>
                <th className="w-28 px-3 py-2 text-left font-normal">Type</th>
                <th className="w-24 px-3 py-2 text-left font-normal">Severity</th>
                <th className="min-w-56 px-3 py-2 text-left font-normal">Activity</th>
                <th className="min-w-40 px-3 py-2 text-left font-normal">Actor / target</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((item) => (
                <tr key={item.key} className="border-b border-line-soft last:border-0 hover:bg-surface-2">
                  <td className="whitespace-nowrap px-3 py-2.5">{item.at ? <TimestampCell value={item.at} /> : <span className="text-fg-disabled">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-fg-muted">{item.kind}</td>
                  <td className="px-3 py-2.5">
                    {item.severity ? <SeverityBadge severity={item.severity} /> : <span className="text-xs text-fg-subtle">—</span>}
                  </td>
                  <td className="max-w-[30rem] break-words px-3 py-2.5">
                    {item.href ? (
                      <Link href={item.href} className="font-mono text-xs text-fg hover:text-signal">{item.action}</Link>
                    ) : <span className="font-mono text-xs text-fg">{item.action}</span>}
                  </td>
                  <td className="max-w-56 break-words px-3 py-2.5 text-xs text-fg-muted">{item.actorOrTarget}</td>
                </tr>
              ))}
            </tbody>
          </Table>
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
}: {
  statuses: Record<string, CollectorHealth>;
  errors: Record<string, string>;
  stalled: string[];
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

  return (
    <details open={needsAttention} className="max-w-full text-xs">
      <summary className="cursor-pointer text-fg hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
        <span className={current.length > 0 && !needsAttention ? "text-sev-resolved" : "text-fg-muted"}>
          {current.length} current
        </span>
        {stale.length > 0 && <span className="ml-2 text-sev-medium">{stale.length} stale</span>}
        {failed.length > 0 && <span className="ml-2 text-sev-critical">{failed.length} failed</span>}
        {pending.length > 0 && <span className="ml-2 text-fg-subtle">{pending.length} pending</span>}
        <span className="ml-2 text-fg-subtle">· details</span>
      </summary>
      <div className="mt-3 space-y-2 border-t border-line-soft pt-2">
        {names.map((name) => {
          const status = statuses[name];
          const error = status?.error ?? errors[name];
          const state = failedSet.has(name) ? "failed" : staleSet.has(name) ? "stale" : status?.state ?? "unknown";
          return (
            <div key={name} className="border-b border-line-soft pb-2 last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-mono text-fg">{name}</span>
                <span className={
                  state === "ok" ? "text-sev-resolved" :
                    state === "failed" ? "text-sev-critical" :
                      state === "stale" ? "text-sev-medium" : "text-fg-subtle"
                }>{state}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-fg-subtle">
                <span>last success {status?.age_seconds == null ? "never" : `${status.age_seconds}s ago`}</span>
                {status && <span>every {status.interval_seconds}s</span>}
                {status?.last_attempt_at && (
                  <span>last attempt {new Date(status.last_attempt_at).toLocaleString()}</span>
                )}
              </div>
              {error && <div className="mt-1 break-words text-sev-critical">{error}</div>}
            </div>
          );
        })}
        {names.length === 0 && <div className="text-fg-subtle">No collector status reported.</div>}
      </div>
    </details>
  );
}

// =========================================================================
// sessions
// =========================================================================

function SessionsSection({ sessions }: { sessions: HostSession[] }) {
  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>currently logged in</SectionLabel>
        <span className="text-[11px] text-fg-subtle">
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </span>
      </div>
      <DataPanel className="overflow-hidden">
        <Table>
          <thead>
            <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <th className="w-32 px-4 py-2 text-left font-normal">User</th>
              <th className="w-24 px-4 py-2 text-left font-normal">TTY</th>
              <th className="w-44 px-4 py-2 text-left font-normal">Source IP</th>
              <th className="px-4 py-2 text-left font-normal">Login</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr
                key={`${s.user}-${s.tty}-${i}`}
                className="border-b border-line-soft last:border-0"
              >
                <td className="px-4 py-2 text-fg">{s.user}</td>
                <td className="px-4 py-2 font-mono text-xs text-fg-muted">{s.tty}</td>
                <td className="px-4 py-2 text-xs">
                  {s.source ? (
                    <IpCell value={s.source} className="text-xs text-fg" />
                  ) : (
                    <span className="text-fg-subtle">local</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-fg-muted">
                  {s.login}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </DataPanel>
    </section>
  );
}

// =========================================================================
// alerts
// =========================================================================

function AlertsSection({ alerts }: { alerts: EventEnvelope[] }) {
  return (
    <section className="mt-6 space-y-2">
      <SectionLabel>recent notable activity · high / critical</SectionLabel>
      <DataPanel className="overflow-hidden">
        <Table>
          <thead>
            <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <th className="w-40 px-4 py-2 text-left font-normal">Time</th>
              <th className="w-24 px-4 py-2 text-left font-normal">Severity</th>
              <th className="px-4 py-2 text-left font-normal">Action</th>
              <th className="w-48 px-4 py-2 text-left font-normal">Actor</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr
                key={a.event_id}
                className="group relative border-b border-line-soft last:border-0 hover:bg-surface-2"
              >
                <td className="relative px-4 py-2.5">
                  <span
                    aria-hidden
                    className={clsx(
                      "pointer-events-none absolute left-0 top-0 h-full w-0.5",
                      severityBorderBg(a.severity as string | null | undefined),
                    )}
                  />
                  <TimestampCell value={a.event_time} />
                </td>
                <td className="px-4 py-2.5">
                  <SeverityBadge severity={(a.severity as string) ?? null} />
                </td>
                <td className="truncate px-4 py-2.5">
                  <Link
                    href={`/events/${a.event_id}`}
                    className="font-mono text-xs text-fg transition-colors hover:text-signal"
                  >
                    {a.action}
                  </Link>
                </td>
                <td className="truncate px-4 py-2.5 text-xs text-fg-muted">
                  {a.actor?.principal ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </DataPanel>
    </section>
  );
}

// =========================================================================
// File Integrity Monitoring (FIM)  — Part 1: periodic baseline
// =========================================================================

function FimSection({
  coverage,
  changes,
}: {
  coverage: FimCoverage | null;
  changes: FimChange[];
}) {
  const realtime = coverage?.inotify_active ?? false;
  const whodata = coverage?.auditd_active ?? false;
  let subtitle: string;
  if (realtime && whodata) {
    subtitle = "real-time · inotify + auditd whodata + 6h baseline scan";
  } else if (realtime) {
    subtitle = "real-time · inotify + 6h baseline scan (whodata off)";
  } else {
    subtitle = "periodic baseline · 6h scan (inotify inactive)";
  }

  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>file integrity</SectionLabel>
        <span className="text-[11px] text-fg-subtle">{subtitle}</span>
      </div>

      <FimCoverageCard coverage={coverage} />

      <DataPanel className="overflow-hidden">
        {changes.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-fg-muted">
            No file integrity changes recorded. The agent will start emitting
            events once it detects drift from the established baseline.
          </div>
        ) : (
          <FimChangesTable changes={changes} />
        )}
      </DataPanel>

      {coverage?.configured_paths && (
        <FimWatchedPaths paths={coverage.configured_paths} />
      )}
    </section>
  );
}

function FimWatchedPaths({ paths }: { paths: FimConfiguredPaths }) {
  return (
    <DataPanel className="space-y-3 px-4 py-3 text-xs">
      <div className="text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
        watched paths · what FIM is monitoring on this host
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PathColumn label="Critical files" paths={paths.critical_files} />
        <PathColumn label="Critical directories" paths={paths.critical_dirs} />
        <PathColumn label="Binary directories" paths={paths.binary_dirs} />
      </div>
      <div className="border-t border-line-soft pt-2 text-[10px] text-fg-subtle">
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
      <div className="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
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
      <div className="border-t border-line-soft pt-2 text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
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

function FimChangesTable({ changes }: { changes: FimChange[] }) {
  return (
    <Table>
      <thead>
        <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
          <th className="w-32 px-4 py-2 text-left font-normal">Time</th>
          <th className="w-28 px-4 py-2 text-left font-normal">Source</th>
          <th className="w-24 px-4 py-2 text-left font-normal">Change</th>
          <th className="px-4 py-2 text-left font-normal">Path</th>
          <th className="w-44 px-4 py-2 text-left font-normal">Who</th>
          <th className="w-44 px-4 py-2 text-left font-normal">Diff</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c, i) => (
          <tr
            key={c.event_id ?? `${c.path}-${i}`}
            className="border-b border-line-soft last:border-0 hover:bg-surface-2"
          >
            <td className="px-4 py-2.5">
              {c.changed_at ? (
                <TimestampCell value={c.changed_at} />
              ) : (
                <span className="text-xs text-fg-disabled">—</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              <FimDetectionPill detection={c.detection_source ?? c.detection} />
            </td>
            <td className="px-4 py-2.5">
              <FimChangePill type={c.change_type} />
            </td>
            <td className="truncate px-4 py-2.5">
              {c.event_id ? (
                <Link
                  href={`/events/${c.event_id}`}
                  className="font-mono text-xs text-fg transition-colors hover:text-signal"
                >
                  {c.path}
                </Link>
              ) : (
                <span className="font-mono text-xs text-fg">{c.path}</span>
              )}
            </td>
            <td className="truncate px-4 py-2.5">
              <FimActorCell change={c} />
            </td>
            <td className="truncate px-4 py-2.5 font-mono text-xs text-fg-muted">
              <FimDiff change={c} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function FimActorCell({ change }: { change: FimChange }) {
  if (change.actor_comm == null && change.actor_uid == null) {
    return (
      <span className="text-xs text-fg-disabled" title="A change was detected, but auditd did not attribute it to a process.">unknown · no attribution</span>
    );
  }
  const comm = change.actor_comm ?? "?";
  const uid = change.actor_uid != null ? `uid=${change.actor_uid}` : null;
  return (
    <span
      className="text-xs text-fg"
      title="Best-effort auditd attribution based on process metadata; not definitive identity proof."
    >
      <span className="font-mono">{comm}</span>
      {uid && (
        <span className="ml-1.5 text-fg-muted">{uid}</span>
      )}
      <span className="ml-1.5 text-fg-subtle">best-effort</span>
    </span>
  );
}

function FimDetectionPill({
  detection,
}: {
  detection: string | null;
}) {
  if (detection === "inotify") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
        <span className="text-fg">real-time</span>
      </span>
    );
  }
  if (detection === "auditd") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-sev-medium" aria-hidden />
        auditd
      </span>
    );
  }
  // baseline or unknown (older rows pre-Part 2 won't have the field)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-fg-disabled" aria-hidden />
      baseline
    </span>
  );
}

function FimChangePill({ type }: { type: FimChange["change_type"] }) {
  // Color encodes how alarming the change is at a glance. Modified content
  // (new sha256) is the most-actionable signal.
  const COLOR: Record<FimChange["change_type"], string> = {
    created:        "bg-sev-medium",
    modified:       "bg-sev-high",
    deleted:        "bg-sev-medium",
    perm_changed:   "bg-sev-medium",
    owner_changed:  "bg-sev-medium",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={clsx("h-1.5 w-1.5 rounded-full", COLOR[type])}
        aria-hidden
      />
      <span className="text-fg-muted">{type.replace("_", " ")}</span>
    </span>
  );
}

function FimDiff({ change }: { change: FimChange }) {
  if (change.change_type === "perm_changed") {
    return (
      <span>
        perm {toOctal(change.perm_before)} → {toOctal(change.perm_after)}
      </span>
    );
  }
  if (change.change_type === "owner_changed") {
    return (
      <span>
        {change.owner_before ?? "—"} → {change.owner_after ?? "—"}
      </span>
    );
  }
  if (change.change_type === "deleted") {
    return <span>was {toOctal(change.perm_before)}, {change.size_before ?? 0} B</span>;
  }
  // created or modified — show sha256 prefix diff. Full 64-char hash is in
  // the event detail; 8 chars is enough for at-a-glance distinction.
  const before = change.sha256_before?.slice(0, 8) ?? "new";
  const after = change.sha256_after?.slice(0, 8) ?? "—";
  return <span>{before} → {after}</span>;
}

function toOctal(p: number | null): string {
  if (p === null) return "—";
  return p.toString(8).padStart(4, "0");
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
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>disk usage</SectionLabel>
        <span className="text-[11px] text-fg-subtle">
          {rows.length} mount{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <DataPanel scrollX>
        <HostInventoryTable title="disk mounts" columns={[
          { label: "Mount", mono: true }, { label: "Filesystem", mono: true },
          { label: "Used" }, { label: "Inodes" }, { label: "Used / total", mono: true },
          { label: "Sampled", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
    </section>
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
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>listening ports</SectionLabel>
        <span className="text-[11px] text-fg-subtle">{rows.length}</span>
      </div>
      <DataPanel scrollX>
        <HostInventoryTable title="listening ports" columns={[
          { label: "Protocol", mono: true }, { label: "Address", mono: true },
          { label: "Port", mono: true }, { label: "Process", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
    </section>
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
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>running processes</SectionLabel>
        <span className="text-[11px] text-fg-subtle">{rows.length}</span>
      </div>
      <DataPanel scrollX>
        <HostInventoryTable title="running processes" columns={[
          { label: "User" }, { label: "PID", mono: true }, { label: "Command", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
    </section>
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
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>users</SectionLabel>
        <span className="text-[11px] text-fg-subtle">{rows.length}</span>
      </div>
      <DataPanel scrollX>
        <HostInventoryTable title="users and access" columns={[
          { label: "Name" }, { label: "UID", mono: true }, { label: "Class and access" },
          { label: "Groups", mono: true }, { label: "Shell", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
    </section>
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
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>authorized SSH keys</SectionLabel>
        <span className="text-[11px] text-fg-subtle">{rows.length}</span>
      </div>
      <DataPanel scrollX>
        <HostInventoryTable title="authorized SSH keys" columns={[
          { label: "User" }, { label: "Fingerprint", mono: true }, { label: "Key preview", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
    </section>
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
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>{title}</SectionLabel>
        <span className="text-[11px] text-fg-subtle">{rows.length}</span>
      </div>
      <DataPanel scrollX>
        <HostInventoryTable title={title} columns={[
          { label: "Path", mono: true }, { label: "SHA-256", mono: true },
        ]} rows={inventoryRows} />
      </DataPanel>
    </section>
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
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>{title}</SectionLabel>
        <span className="text-[11px] text-fg-subtle">{items.length}</span>
      </div>
      <DataPanel scrollX>
        <HostInventoryTable title={title} columns={[{ label: "Value", mono: true }]} rows={inventoryRows} />
      </DataPanel>
    </section>
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
    <section className="mt-6 space-y-2">
      <SectionLabel>{title}</SectionLabel>
      <DataPanel className="overflow-hidden">
        <Table>
          <thead>
            <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <th className="w-40 px-4 py-2 text-left font-normal">Time</th>
              <th className="w-28 px-4 py-2 text-left font-normal">Severity</th>
              <th className="w-56 px-4 py-2 text-left font-normal">Action</th>
              <th className="px-4 py-2 text-left font-normal">Actor / Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.event_id}
                className="group relative border-b border-line-soft last:border-0 hover:bg-surface-2"
              >
                <td className="relative px-4 py-2.5">
                  <span
                    aria-hidden
                    className={clsx(
                      "pointer-events-none absolute left-0 top-0 h-full w-0.5",
                      severityBorderBg(e.severity as string | null | undefined),
                    )}
                  />
                  <TimestampCell value={e.event_time} />
                </td>
                <td className="px-4 py-2.5">
                  <SeverityBadge severity={(e.severity as string) ?? null} />
                </td>
                <td className="truncate px-4 py-2.5">
                  <Link
                    href={`/events/${e.event_id}`}
                    className="font-mono text-xs text-fg transition-colors hover:text-signal"
                  >
                    {e.action}
                  </Link>
                </td>
                <td className="truncate px-4 py-2.5 text-xs text-fg-muted">
                  {e.actor?.principal ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </DataPanel>
    </section>
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
