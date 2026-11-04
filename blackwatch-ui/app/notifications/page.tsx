import Link from "next/link";
import clsx from "clsx";
import { Plus, X } from "lucide-react";

import {
  fetchNotificationChannels,
  fetchNotificationRoutes,
  fetchNotificationLog,
  fetchNotificationAcks,
  fetchPerfAlerts,
  hostLabel,
} from "@/lib/api";
import type {
  NotificationChannel,
  NotificationLogEntry,
  NotificationAck,
  PerfAlertInstance,
  PerfAlertRule,
  Route,
  NotificationCoverageModule,
} from "@/lib/types";

import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationLogTable } from "@/components/domain/NotificationLogTable";
import { NotificationChannelsTable } from "@/components/domain/notifications/NotificationChannelsTable";
import { NotificationRoutesTable } from "@/components/domain/notifications/NotificationRoutesTable";
import { MetricRoutesTable } from "@/components/domain/notifications/MetricRoutesTable";
import { toChannelRow, toMetricRouteRow, toRouteRow } from "@/lib/notification-rows";
import { NotificationModel } from "@/components/domain/notifications/NotificationModel";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { Button } from "@/components/ui/Button";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { FlashToast } from "@/components/ui/FlashToast";
import { StatusDot, type Severity } from "@/components/ui/StatusDot";
import { StatusPill } from "@/components/ui/StatusPill";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { SeverityBadge } from "@/components/domain/SeverityBadge";

import { clearAckAction } from "./actions";

type SearchParams = { msg?: string };

// /notifications — one dashboard.
//
// Three tables (channels, alert routes, metric routes) + activity log.
// Only CONFIGURED routes are shown; empty modules are discovered via the
// [+ Create alert] wizard, not surfaced as coverage-gap rows.
//
// One primary teal CTA on the page: the Create button. Everything else is
// muted so the eye lands on the action that unblocks first-run users.
export const metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { msg } = await searchParams;
  const [channelsData, routesData, logData, acksData, perfData] =
    await Promise.all([
      fetchNotificationChannels(),
      fetchNotificationRoutes(),
      fetchNotificationLog({ limit: 200 }),
      fetchNotificationAcks(),
      fetchPerfAlerts(),
    ]);
  const channelsAvailable = channelsData.channels.length > 0;
  const sent24h = countSince(logData.entries, "sent", 24 * 3600 * 1000);
  const failed24h = countSince(logData.entries, "failed", 24 * 3600 * 1000);

  return (
    <>
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title="Notifications"
        subtitle={`${routesData.routes.length} route${
          routesData.routes.length === 1 ? "" : "s"
        } · ${sent24h} sent (24h) · ${failed24h} failed`}
      />

      <NotificationModel
        routeCount={routesData.routes.length}
        channelCount={channelsData.channels.length}
      />

      {msg && <FlashToast message={msg} />}

      {acksData.acks.length > 0 && <AcksBanner acks={acksData.acks} />}
      {!channelsAvailable && <ChannelsFirstHint />}

      <CoveragePanel coverage={routesData.coverage} />

      {/* CHANNELS */}
      <SectionHeader
        id="channels"
        label="Channels"
        action={{ href: "/notifications/channels/new", label: "add channel" }}
      />
      <ChannelsTable channels={channelsData.channels} />

      {/* ALERT ROUTES */}
      <div id="routes" className="mt-8 mb-2 flex scroll-mt-4 items-baseline justify-between">
        <SectionHeaderLabel>Alert routes</SectionHeaderLabel>
        <Button asChild variant="primary" size="sm">
          <Link href="/notifications/create">
            <Plus size={12} /> Create alert
          </Link>
        </Button>
      </div>
      <RoutesTable routes={routesData.routes} channelsAvailable={channelsAvailable} />

      {/* METRIC ROUTES */}
      <SectionHeader
        label="Metric routes"
        action={{ href: "/notifications/perf-alerts/new", label: "add metric" }}
      />
      <MetricRoutesPanel rules={perfData.rules} instances={perfData.instances} />

      {/* ACTIVITY */}
      <div className="mt-8 mb-2 flex items-baseline justify-between">
        <SectionHeaderLabel>Recent activity · last 50</SectionHeaderLabel>
        <Link
          href="/notifications/log"
          className="text-[11px] text-fg-subtle hover:text-fg"
        >
          full log →
        </Link>
      </div>
      <ActivityTable entries={logData.entries.slice(0, 50)} />
    </>
  );
}

// =========================================================================
// SECTION HEADERS
// =========================================================================

function SectionHeader({
  id,
  label,
  action,
}: {
  id?: string;
  label: string;
  action?: { href: string; label: string };
}) {
  return (
    <div id={id} className="mt-8 mb-2 flex scroll-mt-4 items-end justify-between gap-3">
      <SectionHeaderLabel>{label}</SectionHeaderLabel>
      {action && (
        <Button asChild variant="ghost" size="sm">
          <Link href={action.href}>
            <Plus size={12} /> {action.label}
          </Link>
        </Button>
      )}
    </div>
  );
}

function SectionHeaderLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-fg">
      <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
      {children}
    </h2>
  );
}

// =========================================================================
// CHANNELS
// =========================================================================

function ChannelsTable({ channels }: { channels: NotificationChannel[] }) {
  return (
    <DataPanel className="overflow-hidden">
      {channels.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-fg-muted">
          No channels yet.{" "}
          <Link
            href="/notifications/channels/new"
            className="text-signal hover:underline"
          >
            Add one →
          </Link>
        </div>
      ) : (
        <NotificationChannelsTable channels={channels.map(toChannelRow)} />
      )}
    </DataPanel>
  );
}

// =========================================================================
// ALERT ROUTES — only configured, row-level quick actions
// =========================================================================

function RoutesTable({
  routes,
  channelsAvailable,
}: {
  routes: Route[];
  channelsAvailable: boolean;
}) {
  if (!channelsAvailable) {
    return (
      <DataPanel>
        <div className="px-4 py-6 text-center text-xs text-fg-muted">
          Add a channel first before creating routes.
        </div>
      </DataPanel>
    );
  }
  if (routes.length === 0) {
    return (
      <DataPanel>
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-fg-muted">
            No alerts set up yet.
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            Create your first alert — pick a module, choose severity, wire it to a channel.
          </p>
          <div className="mt-4">
            <Button asChild size="sm" variant="primary">
              <Link href="/notifications/create">
                <Plus size={12} /> Create your first alert
              </Link>
            </Button>
          </div>
        </div>
      </DataPanel>
    );
  }
  // Group by raw module key (source.module value, or "__custom__" bucket).
  // Preserve first-seen order — backend already sorts catalog order → severity.
  const groups: { key: string; label: string; routes: Route[] }[] = [];
  const seen = new Map<string, number>();
  for (const r of routes) {
    const k = r.module || "__custom__";
    let idx = seen.get(k);
    if (idx === undefined) {
      idx = groups.length;
      seen.set(k, idx);
      groups.push({
        key: k,
        label: k === "__custom__" ? "Custom / advanced" : k,
        routes: [],
      });
    }
    groups[idx].routes.push(r);
  }

  return (
    <>
      {groups.map((g) => (
        <CollapsibleSection
          key={g.key}
          storageKey={`bw.notif.routeGroup.${g.key}`}
          title={g.label}
          count={g.routes.length}
        >
          <NotificationRoutesTable
            routes={g.routes.map(toRouteRow)}
            tableId={`notifications-alert-routes-v2-${g.key}`}
            ariaLabel={`Alert routes for ${g.label}`}
          />
        </CollapsibleSection>
      ))}
    </>
  );
}


// =========================================================================
// NOTIFICATION COVERAGE — read-only visibility into every supported event
// =========================================================================

function CoveragePanel({ coverage }: { coverage: NotificationCoverageModule[] }) {
  const totalEvents = coverage.reduce((sum, module) => sum + module.event_count, 0);
  const configured = coverage.reduce((sum, module) => sum + module.counts.configured, 0);
  const fallback = coverage.reduce((sum, module) => sum + module.counts.fallback, 0);
  const muted = coverage.reduce((sum, module) => sum + module.counts.muted, 0);
  const unconfigured = coverage.reduce((sum, module) => sum + module.counts.unconfigured, 0);
  const gaps = coverage.reduce((sum, module) => sum + module.gap_count, 0);
  const contentGaps = coverage.reduce((sum, module) => sum + module.content_gap_count, 0);

  return (
    <section className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <SectionHeaderLabel>Notification coverage</SectionHeaderLabel>
          <p className="mt-1 text-xs text-fg-subtle">Read-only view of every supported event kind. This does not enable or change notifications.</p>
        </div>
        <Link href="/notifications/profiles" className="text-[11px] text-signal hover:underline">Open Notification Studio →</Link>
      </div>
      <DataPanel className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px border-b border-line-soft bg-line-soft sm:grid-cols-6">
          <CoverageSummary label="Configured" value={configured} tone="configured" />
          <CoverageSummary label="Fallback" value={fallback} tone="fallback" />
          <CoverageSummary label="Muted" value={muted} tone="muted" />
          <CoverageSummary label="Unconfigured" value={unconfigured} tone="unconfigured" />
          <CoverageSummary label="High / critical gaps" value={gaps} tone={gaps ? "gap" : "configured"} />
          <CoverageSummary label="Content gaps" value={contentGaps} tone={contentGaps ? "gap" : "configured"} />
        </div>
        <div className="border-b border-line-soft px-4 py-2 text-[11px] text-fg-subtle">
          {coverage.length} modules · {totalEvents} event kinds · content gaps are not-yet-rolled-out message contracts · fallback means a legacy module route covers the event
        </div>
        <div className="divide-y divide-line-soft">
          {coverage.map((module) => <CoverageModuleRow key={module.key} module={module} />)}
        </div>
      </DataPanel>
    </section>
  );
}

function CoverageSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "configured" | "fallback" | "muted" | "unconfigured" | "gap";
}) {
  const toneClass = tone === "configured" ? "text-signal" : tone === "gap" ? "text-sev-critical" : tone === "fallback" ? "text-sev-medium" : "text-fg-muted";
  return <div className="bg-surface-1 px-3 py-3"><p className={clsx("text-lg", toneClass)}>{value}</p><p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-fg-subtle">{label}</p></div>;
}

function CoverageModuleRow({ module }: { module: NotificationCoverageModule }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
        <div className="min-w-0">
          <span className="text-fg">{module.label}</span>
          <span className="ml-2 font-mono text-[10px] text-fg-subtle">{module.key}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <CoverageStatePill state="configured" count={module.counts.configured} />
          <CoverageStatePill state="fallback" count={module.counts.fallback} />
          <CoverageStatePill state="muted" count={module.counts.muted} />
          <CoverageStatePill state="unconfigured" count={module.counts.unconfigured} />
          <ContentRolloutPill status={module.content_status} stage={module.content_rollout_stage} />
          {module.gap_count > 0 && <span className="border border-sev-critical/30 bg-sev-critical/10 px-1.5 py-0.5 text-sev-critical">{module.gap_count} high/critical gaps</span>}
          {module.content_gap_count > 0 && <span className="border border-sev-medium/30 bg-sev-medium/10 px-1.5 py-0.5 text-sev-medium">{module.content_gap_count} content gaps</span>}
        </div>
      </summary>
      <div className="border-t border-line-soft bg-surface-2/40 px-4 py-2">
        <p className="mb-2 text-[11px] text-fg-subtle">{module.blurb} <span className="font-mono text-[10px]">rollout: {module.content_rollout_stage}</span></p>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {module.events.map((event) => (
            <Link key={event.event_kind} href={`/notifications/profiles/${encodeURIComponent(event.profile_id)}`} className="flex items-center justify-between gap-2 rounded-md border border-line-soft bg-surface-1 px-2.5 py-2 hover:border-signal">
              <span className="min-w-0 truncate text-xs text-fg" title={event.description}>{event.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                <CoverageStatePill state={event.state} />
                <ContentRolloutPill status={event.content_status} stage={event.rollout_stage} />
                {event.high_critical_gap && <span className="font-mono text-[9px] text-sev-critical">gap</span>}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}

function CoverageStatePill({
  state,
  count,
}: {
  state: "configured" | "fallback" | "muted" | "unconfigured";
  count?: number;
}) {
  const labels = { configured: "configured", fallback: "fallback", muted: "muted", unconfigured: "unconfigured" };
  const classes = {
    configured: "border-signal/30 bg-signal/10 text-signal",
    fallback: "border-sev-medium/30 bg-sev-medium/10 text-sev-medium",
    muted: "border-line bg-surface-2 text-fg-muted",
    unconfigured: "border-line bg-surface-1 text-fg-subtle",
  };
  return <span className={clsx("border px-1.5 py-0.5", classes[state])}>{labels[state]}{count === undefined ? "" : ` ${count}`}</span>;
}

function ContentRolloutPill({
  status,
  stage,
}: {
  status: string;
  stage: string;
}) {
  const rolledOut = status === "rolled_out";
  return (
    <span
      className={clsx(
        "border px-1.5 py-0.5",
        rolledOut
          ? "border-signal/30 bg-signal/5 text-signal"
          : "border-sev-medium/30 bg-sev-medium/10 text-sev-medium",
      )}
      title={`Message contract rollout stage: ${stage}`}
    >
      {rolledOut ? "content ready" : "content gap"}
    </span>
  );
}

// =========================================================================
// METRIC ROUTES
// =========================================================================

function MetricRoutesPanel({
  rules,
  instances,
}: {
  rules: PerfAlertRule[];
  instances: PerfAlertInstance[];
}) {
  // Resolve display_name > hostname > id once, on the server.
  const byId = new Map(instances.map((i) => [i.instance_id, i]));

  return (
    <DataPanel className="overflow-hidden">
      {rules.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-fg-muted">
          No metric routes yet.{" "}
          <Link
            href="/notifications/perf-alerts/new"
            className="text-signal hover:underline"
          >
            Add one →
          </Link>
        </div>
      ) : (
        <MetricRoutesTable rules={rules.map((rule) => toMetricRouteRow(rule, byId, hostLabel))} />
      )}
    </DataPanel>
  );
}

// =========================================================================
// ACTIVITY
// =========================================================================

function ActivityTable({ entries }: { entries: NotificationLogEntry[] }) {
  return (
    <DataPanel className="overflow-hidden">
      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-fg-muted">
          Nothing has fired yet.
        </div>
      ) : (
        <NotificationLogTable
          entries={entries}
          variant="compact"
          tableId="notifications-activity"
          ariaLabel="Recent notification activity"
        />
      )}
    </DataPanel>
  );
}

// =========================================================================
// ACKS BANNER
// =========================================================================

function AcksBanner({ acks }: { acks: NotificationAck[] }) {
  return (
    <section className="mb-6 mt-3 rounded-md border border-line-soft bg-surface-1">
      <div className="flex items-baseline justify-between border-b border-line-soft px-4 py-2">
        <span className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
          {acks.length} active ack{acks.length === 1 ? "" : "s"} · paused notifications
        </span>
      </div>
      <div className="divide-y divide-line-soft">
        {acks.map((a) => (
          <div
            key={a.fingerprint}
            className="grid min-w-0 grid-cols-1 items-start gap-2 px-4 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_220px_80px] sm:items-center sm:gap-4"
          >
            <div className="truncate">
              <code className="font-mono text-fg">{a.fingerprint.slice(0, 24)}…</code>
              {a.reason && <span className="ml-2 text-fg-muted">· {a.reason}</span>}
            </div>
            <div className="text-fg-subtle">
              until <TimestampCell value={a.ack_until} />
            </div>
            <div className="text-right">
              <form action={clearAckAction} className="inline">
                <input type="hidden" name="fingerprint" value={a.fingerprint} />
                <Button type="submit" size="sm" variant="ghost">
                  <X size={12} /> clear
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =========================================================================
// HINTS + SMALL BITS
// =========================================================================

function ChannelsFirstHint() {
  return (
    <div className="mt-3 border border-sev-medium/30 bg-sev-medium/5 px-4 py-3 text-sm text-fg-muted">
      <span className="text-sev-medium">▸</span> Start by adding a channel — Slack,
      email, webhook, PagerDuty, etc.{" "}
      <Link href="/notifications/channels/new" className="text-signal hover:underline">
        Add one →
      </Link>{" "}
      then create alerts below.
    </div>
  );
}

function EnabledPill({ enabled }: { enabled: boolean }) {
  return <StatusPill label={enabled ? "enabled" : "disabled"} severity={enabled ? "resolved" : "neutral"} />;
}

function ChannelStatusPill({
  status,
  error,
}: {
  status: string | null;
  error: string | null;
}) {
  const sev: Severity = status === "ok" ? "resolved" : status ? "critical" : "neutral";
  const label = status ?? "never";
  return <StatusPill label={label} severity={sev} title={error ?? undefined} />;
}

function countSince(
  entries: NotificationLogEntry[],
  status: string,
  windowMs: number,
): number {
  const cutoff = Date.now() - windowMs;
  return entries.filter(
    (e) => e.status === status && new Date(e.ts).getTime() >= cutoff,
  ).length;
}
