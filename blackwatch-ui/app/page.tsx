import Link from "next/link";
import clsx from "clsx";

import { fetchAgentIngressDiagnostics, fetchConnectors, fetchOverview } from "@/lib/api";
import { buildAttentionItems } from "@/lib/attention";
import { toEventTableRow } from "@/lib/event-summary";
import type { EventEnvelope } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { PageSection } from "@/components/layout/PageSection";
import { AttentionStrip } from "@/components/domain/AttentionStrip";
import { EventsDataTable } from "@/components/domain/EventsDataTable";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SeverityBadge,
  severityBorderBg,
} from "@/components/domain/SeverityBadge";

export default async function Home() {
  // Overview is the one required call. Connector and ingest health only enrich
  // the attention list, so a failure there must not take the page down.
  const [data, connectors, ingress] = await Promise.all([
    fetchOverview(),
    fetchConnectors().catch(() => null),
    fetchAgentIngressDiagnostics(1).catch(() => null),
  ]);
  const attention = buildAttentionItems({ overview: data, connectors, ingress });

  return (
    <>
      <AutoRefresh intervalMs={10_000} />
      <PageHeader
        title="Overview"
        subtitle="Live state across detection, posture, and host telemetry."
      />

      <AttentionStrip items={attention} />

      {/* Top-level KPI strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Events, last 24h"
          value={fmtCount(data.volume_24h)}
          accent="neutral"
          href="/events"
        />
        <Kpi
          label="Open posture findings"
          value={String(data.posture.total_open)}
          accent={
            data.posture.by_severity.critical > 0
              ? "critical"
              : data.posture.by_severity.high > 0
                ? "high"
                : data.posture.total_open > 0
                  ? "medium"
                  : "ok"
          }
          href="/aws-posture"
        />
        <Kpi
          label="Hosts reporting"
          value={`${data.hosts.reporting}/${data.hosts.total}`}
          accent={
            data.hosts.stale > 0 && data.hosts.total > 0
              ? "medium"
              : data.hosts.total > 0
                ? "ok"
                : "neutral"
          }
          href="/hosts"
        />
        <Kpi
          label="High / critical events"
          hint="in the latest 200 events"
          value={String(data.notable.length)}
          accent={data.notable.length > 0 ? "high" : "ok"}
          href="/events?severity=high"
        />
      </div>

      {/* Notable events first: this is the triage queue. */}
      <PageSection
        title="Needs triage"
        description="High and critical events from the latest 200."
        action={{ href: "/events?severity=high", label: "All high and critical events" }}
      >
        <DataPanel className="overflow-hidden">
          {data.notable.length === 0 ? (
            <EmptyState tone="ok">No high or critical events in the recent window.</EmptyState>
          ) : (
            <CompactEventsTable events={data.notable} tableId="overview-notable" />
          )}
        </DataPanel>
      </PageSection>

      {/* Posture severity breakdown */}
      <PageSection
        title="Posture"
        description="Open AWS configuration findings by severity."
        action={{ href: "/aws-posture", label: "All findings" }}
      >
        <DataPanel className="grid gap-4 p-4 md:grid-cols-[minmax(170px,0.7fr)_minmax(0,2fr)] md:items-center">
          <div className="border-b border-line-soft pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-5">
            <div className="text-xs text-fg-muted">Total open findings</div>
            <div className="mt-1 font-mono text-4xl tabular-nums text-fg">
              {data.posture.total_open}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <PostureCell label="Critical" count={data.posture.by_severity.critical} accent="critical" total={data.posture.total_open} />
            <PostureCell label="High" count={data.posture.by_severity.high} accent="high" total={data.posture.total_open} />
            <PostureCell label="Medium" count={data.posture.by_severity.medium} accent="medium" total={data.posture.total_open} />
            <PostureCell label="Low" count={data.posture.by_severity.low} accent="low" total={data.posture.total_open} />
            <PostureCell label="Info" count={data.posture.by_severity.informational} accent="low" total={data.posture.total_open} />
          </div>
        </DataPanel>
      </PageSection>

      {/* Recent events tail */}
      <PageSection
        title="Latest events"
        description="The 10 most recent events across all sources."
        action={{ href: "/events", label: "All events" }}
      >
        <DataPanel className="overflow-hidden">
          {data.recent.length === 0 ? (
            <EmptyState>No events yet. Has an agent or connector reported?</EmptyState>
          ) : (
            <CompactEventsTable events={data.recent} tableId="overview-recent" />
          )}
        </DataPanel>
      </PageSection>
    </>
  );
}

// =========================================================================
// pieces
// =========================================================================

type KpiAccent = "ok" | "neutral" | "critical" | "high" | "medium";

function Kpi({
  label,
  value,
  accent,
  href,
  hint,
}: {
  label: string;
  value: string;
  accent: KpiAccent;
  href: string;
  hint?: string;
}) {
  const dot =
    accent === "critical"
      ? "bg-sev-critical"
      : accent === "high"
        ? "bg-sev-high"
        : accent === "medium"
          ? "bg-sev-medium"
          : accent === "ok"
            ? "bg-sev-resolved"
            : "bg-fg-subtle";
  return (
    <Link
      href={href}
      className="group block border border-line-soft bg-surface-1 px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          aria-hidden
          className={clsx("h-1.5 w-1.5 translate-y-[-3px] rounded-full", dot)}
        />
        <span className="font-mono text-3xl tabular-nums text-fg">{value}</span>
      </div>
      {hint && <div className="mt-1 text-xs text-fg-subtle">{hint}</div>}
    </Link>
  );
}

function PostureCell({
  label,
  count,
  accent,
  total,
}: {
  label: string;
  count: number;
  accent: "critical" | "high" | "medium" | "low";
  total: number;
}) {
  const empty = count === 0;
  const dot = empty
    ? "bg-sev-resolved"
    : accent === "critical"
      ? "bg-sev-critical"
      : accent === "high"
        ? "bg-sev-high"
        : accent === "medium"
          ? "bg-sev-medium"
          : "bg-sev-low";
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="border border-line-soft bg-canvas/30 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs text-fg-muted">
        {label}
        <span className="font-mono text-xs text-fg-subtle">{percentage}%</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          aria-hidden
          className={clsx("h-1.5 w-1.5 translate-y-[-3px] rounded-full", dot)}
        />
        <span
          className={clsx(
            "font-mono text-2xl tabular-nums",
            empty ? "text-fg-disabled" : "text-fg",
          )}
        >
          {count}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden bg-surface-2" aria-hidden="true">
        <div className={clsx("h-full", dot)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function CompactEventsTable({ events, tableId }: { events: EventEnvelope[]; tableId: string }) {
  return (
    <EventsDataTable
      events={events.map(toEventTableRow)}
      variant="compact"
      tableId={tableId}
      ariaLabel="Events"
    />
  );
}

function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
