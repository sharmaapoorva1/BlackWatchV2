import Link from "next/link";
import clsx from "clsx";

import { fetchAgentIngressDiagnostics, fetchHosts } from "@/lib/api";
import type { EventEnvelope } from "@/lib/types";
import { HostFleetTable } from "@/components/domain/HostFleetTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { PageSection } from "@/components/layout/PageSection";
import { Table } from "@/components/ui/Table";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventActionCell } from "@/components/domain/EventActionCell";
import { SeverityBadge, severityBorderBg } from "@/components/domain/SeverityBadge";

export default async function HostsPage() {
  const [{ count, servers, auth, changes }, ingress] = await Promise.all([
    fetchHosts(),
    fetchAgentIngressDiagnostics(1).catch(() => null),
  ]);

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="Hosts"
        subtitle={`${count} EC2 host${count === 1 ? "" : "s"} · fleet health and host activity`}
      />

      <div className="space-y-8">
        <HostFleetTable servers={servers} />

        <PageSection
          title="Recent host activity"
          description="SSH/sudo access and host configuration changes, newest first."
          action={{ href: "/events", label: "All events" }}
          flush
        >
          <DataPanel scrollX>
            {auth.length + changes.length === 0 ? (
              <EmptyState>No host access or configuration activity recorded yet.</EmptyState>
            ) : (
              <HostActivityTable auth={auth} changes={changes} />
            )}
          </DataPanel>
        </PageSection>

        {ingress && (
          <PageSection
            title="Agent ingestion"
            description="Transport and processing health for direct host reports."
            flush
          >
            <DataPanel className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-wider text-signal">{ingress.transport}</span>
              <IngestionMetric label="accept p95" value={ingress.metrics?.acceptance_p95_seconds == null ? "—" : `${ingress.metrics.acceptance_p95_seconds.toFixed(2)}s`} />
              <IngestionMetric label="processing p95" value={ingress.metrics?.processing_p95_seconds == null ? "—" : `${ingress.metrics.processing_p95_seconds.toFixed(2)}s`} />
              <IngestionMetric label="retrying" value={String(ingress.metrics?.retrying ?? "—")} tone={(ingress.metrics?.retrying ?? 0) > 0 ? "warn" : undefined} />
              <IngestionMetric label="quarantined" value={String(ingress.metrics?.quarantined ?? "—")} tone={(ingress.metrics?.quarantined ?? 0) > 0 ? "critical" : undefined} />
              <IngestionMetric label="oldest active" value={ingress.spool.oldest_active_age_seconds == null ? "clear" : `${Math.round(ingress.spool.oldest_active_age_seconds)}s`} />
            </DataPanel>
          </PageSection>
        )}
      </div>
    </>
  );
}

function IngestionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "critical";
}) {
  return (
    <div className="min-w-20 space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className={clsx(
        "font-mono text-xs",
        tone === "critical" ? "text-sev-critical" : tone === "warn" ? "text-sev-medium" : "text-fg",
      )}>{value}</div>
    </div>
  );
}

function eventHostLabel(event: EventEnvelope): string {
  const extra = (event.extra as Record<string, unknown> | undefined) ?? {};
  const tags = extra.tags as Record<string, string> | undefined;
  return tags?.role ?? event.target?.name ?? event.target?.id ?? "—";
}

function HostActivityTable({
  auth,
  changes,
}: {
  auth: EventEnvelope[];
  changes: EventEnvelope[];
}) {
  const rows = [
    ...auth.map((event) => ({ event, kind: "Access" })),
    ...changes.map((event) => ({ event, kind: "Host change" })),
  ].sort((a, b) => Date.parse(b.event.event_time) - Date.parse(a.event.event_time));

  return (
    <Table tableId="host-fleet-activity" ariaLabel="Recent host access and configuration activity">
      <thead>
        <tr className="border-b border-line-soft text-xs text-fg-muted">
          <th className="w-36 px-3 py-2 text-left font-normal">When</th>
          <th className="w-28 px-3 py-2 text-left font-normal">Type</th>
          <th className="w-24 px-3 py-2 text-left font-normal">Result</th>
          <th className="w-40 px-3 py-2 text-left font-normal">Host</th>
          <th className="min-w-56 px-3 py-2 text-left font-normal">Activity</th>
          <th className="min-w-44 px-3 py-2 text-left font-normal">Details</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ event, kind }) => {
          const actor = event.actor as { principal?: string; source_ip?: string } | undefined;
          const targetId = event.target?.id;
          return (
            <tr key={event.event_id} className="border-b border-line-soft last:border-0 hover:bg-surface-2">
              <td className="whitespace-nowrap px-3 py-2.5"><TimestampCell value={event.event_time} /></td>
              <td className="px-3 py-2.5 text-xs text-fg-muted">{kind}</td>
              <td className="relative px-3 py-2.5">
                {kind === "Access" ? <OutcomePill outcome={event.outcome} /> : <SeverityBadge severity={event.severity} />}
                {kind !== "Access" && <span aria-hidden className={clsx("pointer-events-none absolute left-0 top-0 h-full w-0.5", severityBorderBg(event.severity))} />}
              </td>
              <td className="truncate px-3 py-2.5 text-xs text-fg-muted">
                {targetId?.startsWith("i-") ? <Link href={`/hosts/${targetId}`} className="hover:text-signal">{eventHostLabel(event)}</Link> : eventHostLabel(event)}
              </td>
              <td className="max-w-[28rem] break-words px-3 py-2.5">
                <EventActionCell eventId={event.event_id} action={event.action} />
              </td>
              <td className="max-w-64 break-words px-3 py-2.5 text-xs text-fg-muted">
                {kind === "Access" ? (
                  <span>{actor?.principal ?? "unknown user"}{actor?.source_ip ? <> · <IpCell value={actor.source_ip} className="text-xs text-fg-muted" /></> : ""}</span>
                ) : <ChangeDetail event={event} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function OutcomePill({ outcome }: { outcome: string | undefined }) {
  const success = outcome === "success";
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs", success ? "text-fg-muted" : "text-sev-critical")}>
      <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", success ? "bg-sev-resolved" : "bg-sev-critical")} />
      {success ? "success" : outcome?.replaceAll("_", " ") ?? "unknown"}
    </span>
  );
}

function ChangeDetail({ event }: { event: EventEnvelope }) {
  const extra = (event.extra as Record<string, unknown> | undefined) ?? {};
  const parts: string[] = [];
  if (extra.port) parts.push(`port ${String(extra.proto ?? "")}/${String(extra.port)} on ${String(extra.address ?? "—")}`);
  else if (extra.fingerprint) parts.push(`${String(extra.user ?? "")} · fp ${String(extra.fingerprint).slice(0, 12)}`);
  else if (extra.user) parts.push(`user ${String(extra.user)}`);
  if (extra.path) parts.push(`${String(extra.path)}${extra.change ? ` · ${String(extra.change)}` : ""}`);
  if (extra.unit) parts.push(String(extra.unit));
  if (extra.added_count !== undefined) parts.push(`+${String(extra.added_count)} / −${String(extra.removed_count)} packages`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
