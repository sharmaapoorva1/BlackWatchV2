"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { DataPanel } from "@/components/layout/DataPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Table } from "@/components/ui/Table";
import type { HostSummary } from "@/lib/types";

type FleetGroup = "healthy" | "attention" | "silent";

function hostState(host: HostSummary): string {
  const reported = host.health_state ?? (host.stale || !host.active ? "silent" : "healthy");
  return host.stale && reported === "healthy" ? "silent" : reported;
}

function hostGroup(host: HostSummary): FleetGroup {
  const state = hostState(host);
  if (state === "healthy") return "healthy";
  if (state === "silent" || !host.active || host.stale) return "silent";
  return "attention";
}

function hostSearchText(host: HostSummary): string {
  return [
    host.display_name,
    host.hostname,
    host.instance_id,
    host.account,
    host.region,
    ...Object.entries(host.tags ?? {}).flat(),
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function relativeAge(seconds: number): string {
  const age = Math.max(0, Math.floor(seconds));
  if (age < 60) return `${age}s ago`;
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  if (age < 86400) return `${Math.floor(age / 3600)}h ago`;
  return `${Math.floor(age / 86400)}d ago`;
}

function AgentState({ host }: { host: HostSummary }) {
  const state = hostState(host);
  const reason = host.health_reason ?? host.delivery?.reason;
  const tone = state === "healthy"
    ? "text-sev-resolved"
    : state === "silent" || state === "data_loss_risk"
      ? "text-sev-critical"
      : "text-sev-medium";
  const dot = state === "healthy"
    ? "bg-sev-resolved"
    : state === "silent" || state === "data_loss_risk"
      ? "bg-sev-critical"
      : "bg-sev-medium";

  return (
    <div className="max-w-52 space-y-1" title={reason ?? undefined}>
      <span className={`inline-flex items-center gap-1.5 text-xs ${tone}`}>
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        {state.replaceAll("_", " ")}
      </span>
      <div className="font-mono text-[11px] text-fg-subtle">
        {host.age_seconds == null ? "no report yet" : relativeAge(host.age_seconds)}
        {host.delivery?.queue_delay_seconds != null && host.delivery.queue_delay_seconds > 0 && (
          <span title="Time from agent send to server acceptance"> · queue {Math.round(host.delivery.queue_delay_seconds)}s</span>
        )}
      </div>
      {state !== "healthy" && reason && (
        <div className="max-w-52 break-words text-[11px] text-fg-muted">{reason}</div>
      )}
    </div>
  );
}

function SurfaceCount({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex min-w-12 items-baseline justify-between gap-2 font-mono text-xs">
      <span className="text-fg">{value}</span>
      <span className="text-[10px] text-fg-subtle">{label}</span>
    </span>
  );
}

export function HostFleetTable({ servers }: { servers: HostSummary[] }) {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("");
  const [environment, setEnvironment] = useState("");

  const environments = useMemo(
    () => [...new Set(servers.map((host) => host.tags?.env).filter((value): value is string => Boolean(value)))].sort(),
    [servers],
  );

  const counts = useMemo(() => {
    const result: Record<FleetGroup, number> = { healthy: 0, attention: 0, silent: 0 };
    for (const host of servers) result[hostGroup(host)] += 1;
    return result;
  }, [servers]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return servers
      .filter((host) => !normalized || hostSearchText(host).includes(normalized))
      .filter((host) => !health || hostGroup(host) === health)
      .filter((host) => !environment || host.tags?.env === environment)
      .sort((left, right) => {
        const order: Record<FleetGroup, number> = { attention: 0, silent: 1, healthy: 2 };
        const groupOrder = order[hostGroup(left)] - order[hostGroup(right)];
        if (groupOrder !== 0) return groupOrder;
        return (right.age_seconds ?? Number.MAX_SAFE_INTEGER) - (left.age_seconds ?? Number.MAX_SAFE_INTEGER);
      });
  }, [servers, query, health, environment]);

  const hasFilters = Boolean(query || health || environment);

  return (
    <section aria-labelledby="host-fleet-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="host-fleet-title" className="font-display text-base font-semibold text-fg">Fleet</h2>
          <p className="mt-1 text-sm text-fg-muted">Hosts needing attention are listed first. Open a host to investigate its collected evidence.</p>
        </div>
        <span className="font-mono text-xs text-fg-subtle">{rows.length} of {servers.length} hosts</span>
      </div>

      <DataPanel scrollX>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line-soft px-4 py-3 text-xs">
          <span className="mr-1 text-fg-muted">Fleet health</span>
          {([
            ["healthy", "healthy", "text-sev-resolved"],
            ["attention", "needs attention", "text-sev-medium"],
            ["silent", "silent", "text-sev-critical"],
          ] as const).map(([group, label, tone]) => (
            <button
              key={group}
              type="button"
              aria-pressed={health === group}
              onClick={() => setHealth((current) => current === group ? "" : group)}
              className={`min-h-11 rounded-sm px-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:min-h-9 ${tone} ${health === group ? "bg-surface-2 underline underline-offset-4" : ""}`}
            >
              <span className="font-mono tabular-nums">{counts[group]}</span> {label}
            </button>
          ))}
        </div>

        <div role="search" aria-label="Filter host fleet" className="grid gap-3 border-b border-line-soft p-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_10rem_10rem_auto] lg:items-end">
          <label className="min-w-0 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">Find a host</span>
            <span className="relative block">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <Input
                aria-label="Search hosts"
                autoComplete="off"
                className="pl-8"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, hostname, ID, tag…"
                type="search"
                value={query}
              />
            </span>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">Health</span>
            <NativeSelect aria-label="Filter by agent health" className="w-full" onChange={(event) => setHealth(event.target.value)} value={health}>
              <option value="">Any health</option>
              <option value="attention">Needs attention</option>
              <option value="silent">Silent</option>
              <option value="healthy">Healthy</option>
            </NativeSelect>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">Environment</span>
            <NativeSelect aria-label="Filter by environment" className="w-full" onChange={(event) => setEnvironment(event.target.value)} value={environment}>
              <option value="">All environments</option>
              {environments.map((value) => <option key={value} value={value}>{value}</option>)}
            </NativeSelect>
          </label>
          {hasFilters && (
            <button type="button" onClick={() => { setQuery(""); setHealth(""); setEnvironment(""); }} className="min-h-11 px-2 text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:min-h-8">
              Clear filters
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState>{servers.length === 0 ? "No hosts are reporting. Install and configure the BlackWatch host agent to begin." : "No hosts match these filters."}</EmptyState>
        ) : (
          <Table tableId="host-fleet" ariaLabel="BlackWatch host fleet">
            <thead>
              <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                <th className="min-w-56 px-3 py-2 text-left font-normal">Host</th>
                <th className="w-28 px-3 py-2 text-left font-normal">Environment</th>
                <th className="w-32 px-3 py-2 text-left font-normal">Role</th>
                <th className="min-w-40 px-3 py-2 text-left font-normal">Agent / last report</th>
                <th className="w-28 px-3 py-2 text-left font-normal">Region</th>
                <th className="w-24 px-3 py-2 text-right font-normal">Ports</th>
                <th className="w-24 px-3 py-2 text-right font-normal">Users</th>
                <th className="w-24 px-3 py-2 text-right font-normal">SSH keys</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((host) => {
                const name = host.display_name || host.hostname || host.tags?.role || host.instance_id;
                const secondary = [host.display_name && host.hostname !== host.display_name ? host.hostname : null, host.instance_id].filter(Boolean).join(" · ");
                return (
                  <tr key={host.instance_id} className="border-b border-line-soft last:border-0 hover:bg-surface-2">
                    <td className="max-w-80 px-3 py-2.5">
                      <Link href={`/hosts/${host.instance_id}`} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                        <span className="block truncate text-sm text-fg hover:text-signal">{name}</span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-fg-subtle">{secondary}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-fg-muted">{host.tags?.env ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-fg-muted">{host.tags?.role ?? "—"}</td>
                    <td className="px-3 py-2.5"><AgentState host={host} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-fg-muted">{host.region ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right"><SurfaceCount value={host.port_count} label="ports" /></td>
                    <td className="px-3 py-2.5 text-right"><SurfaceCount value={host.user_count} label="users" /></td>
                    <td className="px-3 py-2.5 text-right"><SurfaceCount value={host.key_count} label="keys" /></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </DataPanel>
    </section>
  );
}
