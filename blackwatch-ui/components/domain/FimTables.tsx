"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { FimChange, FimHostRow, FimPathSummary, FimStrayBaseline } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { TimestampCell } from "./TimestampCell";

const NUMERIC = "text-right font-mono text-xs";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function humanAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function toOctal(perm: number | null): string {
  return perm == null ? "—" : perm.toString(8).padStart(4, "0");
}

function StatePill({ ok, onLabel, offLabel }: { ok: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={clsx("h-1.5 w-1.5 rounded-full", ok ? "bg-sev-resolved" : "bg-sev-medium")} aria-hidden />
      <span className={ok ? "text-fg-muted" : "text-fg"}>{ok ? onLabel : offLabel}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Monitored hosts
// ---------------------------------------------------------------------------

/** `now` comes from the server so the "N minutes ago" text is identical on the
 *  server render and in the browser (no hydration mismatch). */
export function FimHostsTable({ hosts, now }: { hosts: FimHostRow[]; now: number }) {
  const columns = useMemo<ColumnDef<FimHostRow, unknown>[]>(
    () => [
      {
        id: "env",
        header: "Env",
        accessorFn: (h) => h.tags?.env ?? "",
        meta: { label: "Env", className: "text-xs text-fg" },
        cell: ({ row }) => row.original.tags?.env ?? "—",
      },
      {
        id: "role",
        header: "Role",
        accessorFn: (h) => h.tags?.role ?? "",
        meta: { label: "Role", className: "text-xs text-fg" },
        cell: ({ row }) => row.original.tags?.role ?? "—",
      },
      {
        id: "instance",
        header: "Instance",
        accessorFn: (h) => h.instance_id,
        enableHiding: false,
        meta: { label: "Instance" },
        cell: ({ row }) => (
          <Link
            href={`/fim/${encodeURIComponent(row.original.instance_id)}`}
            className="font-mono text-xs text-fg transition-colors hover:text-signal"
          >
            {row.original.instance_id}
          </Link>
        ),
      },
      {
        id: "hostname",
        header: "Hostname",
        accessorFn: (h) => h.hostname ?? "",
        meta: { label: "Hostname", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.hostname ?? "—",
      },
      {
        id: "files",
        header: "Files",
        accessorFn: (h) => h.files_tracked,
        sortDescFirst: true,
        meta: { label: "Files", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => row.original.files_tracked,
      },
      {
        id: "paths",
        header: "Paths",
        accessorFn: (h) => h.paths_configured,
        sortDescFirst: true,
        meta: { label: "Paths", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => row.original.paths_configured,
      },
      {
        id: "realtime",
        header: "Real-time",
        accessorFn: (h) => (h.inotify_active ? 1 : 0),
        meta: { label: "Real-time" },
        cell: ({ row }) => (
          <StatePill ok={row.original.inotify_active} onLabel={`${row.original.inotify_watch_count} watches`} offLabel="inactive" />
        ),
      },
      {
        id: "whodata",
        header: "Whodata",
        accessorFn: (h) => (h.auditd_active ? 1 : 0),
        meta: { label: "Whodata" },
        cell: ({ row }) => <StatePill ok={row.original.auditd_active} onLabel="auditd live" offLabel="not loaded" />,
      },
      {
        id: "last_scan",
        header: "Last scan",
        accessorFn: (h) => (h.last_full_scan_at ? Date.parse(h.last_full_scan_at) || 0 : 0),
        sortDescFirst: true,
        meta: { label: "Last scan" },
        cell: ({ row }) => {
          const { last_full_scan_at: value, stale } = row.original;
          if (!value) return <span className="font-mono text-xs text-fg-disabled">—</span>;
          return (
            <span className="font-mono text-xs">
              <span className="text-fg-muted">{humanAge((now - new Date(value).getTime()) / 1000)}</span>
              {stale && <span className="ml-1.5 text-xs text-sev-medium">stale</span>}
            </span>
          );
        },
      },
    ],
    [now],
  );
  return (
    <DataTable
      tableId="fim-hosts-v2"
      ariaLabel="File integrity monitored hosts"
      columns={columns}
      data={hosts}
      getRowId={(h) => h.instance_id}
    />
  );
}

// ---------------------------------------------------------------------------
// Changes (cross-host feed and per-instance history share one table)
// ---------------------------------------------------------------------------

type ChangeRow = FimChange & { instance_id?: string };

function DetectionPill({ detection }: { detection: string | null | undefined }) {
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
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-fg-disabled" aria-hidden />
      baseline
    </span>
  );
}

const CHANGE_COLOR: Record<FimChange["change_type"], string> = {
  created: "bg-sev-medium",
  modified: "bg-sev-high",
  deleted: "bg-sev-medium",
  perm_changed: "bg-sev-medium",
  owner_changed: "bg-sev-medium",
};

function ChangeTypePill({ type }: { type: FimChange["change_type"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={clsx("h-1.5 w-1.5 rounded-full", CHANGE_COLOR[type])} aria-hidden />
      <span className="text-fg-muted">{type.replace("_", " ")}</span>
    </span>
  );
}

function ActorCell({ change }: { change: FimChange }) {
  if (change.actor_comm == null && change.actor_uid == null) {
    return (
      <span className="text-xs text-fg-disabled" title="A change was detected, but auditd did not attribute it to a process.">
        unknown · no attribution
      </span>
    );
  }
  return (
    <span className="text-xs text-fg" title="Best-effort auditd attribution based on process metadata; not definitive identity proof.">
      <span className="font-mono">{change.actor_comm ?? "?"}</span>
      {change.actor_uid != null && <span className="ml-1.5 text-fg-muted">uid={change.actor_uid}</span>}
      <span className="ml-1.5 text-fg-subtle">best-effort</span>
    </span>
  );
}

function DiffCell({ change }: { change: FimChange }) {
  if (change.change_type === "perm_changed") {
    return <span>perm {toOctal(change.perm_before)} → {toOctal(change.perm_after)}</span>;
  }
  if (change.change_type === "owner_changed") {
    return <span>{change.owner_before ?? "—"} → {change.owner_after ?? "—"}</span>;
  }
  if (change.change_type === "deleted") {
    return <span>was {toOctal(change.perm_before)}, {change.size_before ?? 0} B</span>;
  }
  const before = change.sha256_before?.slice(0, 8) ?? "new";
  const after = change.sha256_after?.slice(0, 8) ?? "—";
  return <span>{before} → {after}</span>;
}

/** `scope="all-hosts"` adds a Host column; `scope="host"` adds a Diff column. */
export function FimChangesTable({
  changes,
  scope,
  detectionKey = "detection",
  detectedLabel = "Detected",
}: {
  changes: ChangeRow[];
  scope: "all-hosts" | "host";
  /** The host detail page reports the more specific `detection_source`. */
  detectionKey?: "detection" | "detection_source";
  detectedLabel?: string;
}) {
  const columns = useMemo<ColumnDef<ChangeRow, unknown>[]>(() => {
    const time: ColumnDef<ChangeRow, unknown> = {
      id: "time",
      header: "Time",
      accessorFn: (c) => (c.changed_at ? Date.parse(c.changed_at) || 0 : 0),
      sortDescFirst: true,
      enableHiding: false,
      meta: { label: "Time", className: "whitespace-nowrap" },
      cell: ({ row }) =>
        row.original.changed_at ? <TimestampCell value={row.original.changed_at} /> : <span className="text-xs text-fg-disabled">—</span>,
    };
    const detected: ColumnDef<ChangeRow, unknown> = {
      id: "detected",
      header: detectedLabel,
      accessorFn: (c) => (detectionKey === "detection_source" ? (c.detection_source ?? c.detection) : c.detection) ?? "baseline",
      meta: { label: detectedLabel },
      cell: ({ row }) => (
        <DetectionPill detection={detectionKey === "detection_source" ? (row.original.detection_source ?? row.original.detection) : row.original.detection} />
      ),
    };
    const change: ColumnDef<ChangeRow, unknown> = {
      id: "change",
      header: "Change",
      accessorFn: (c) => c.change_type,
      meta: { label: "Change" },
      cell: ({ row }) => <ChangeTypePill type={row.original.change_type} />,
    };
    const host: ColumnDef<ChangeRow, unknown> = {
      id: "host",
      header: "Host",
      accessorFn: (c) => c.instance_id ?? "",
      meta: { label: "Host" },
      cell: ({ row }) =>
        row.original.instance_id ? (
          <Link
            href={`/fim/${encodeURIComponent(row.original.instance_id)}`}
            className="font-mono text-xs text-fg-muted transition-colors hover:text-signal"
          >
            {row.original.instance_id}
          </Link>
        ) : (
          "—"
        ),
    };
    const path: ColumnDef<ChangeRow, unknown> = {
      id: "path",
      header: "Path",
      accessorFn: (c) => c.path,
      meta: { label: "Path", className: "break-all" },
      cell: ({ row }) =>
        row.original.event_id ? (
          <Link
            href={`/events/${row.original.event_id}`}
            className="font-mono text-xs text-fg transition-colors hover:text-signal"
          >
            {row.original.path}
          </Link>
        ) : (
          <span className="font-mono text-xs text-fg">{row.original.path}</span>
        ),
    };
    const who: ColumnDef<ChangeRow, unknown> = {
      id: "who",
      header: "Who",
      accessorFn: (c) => c.actor_comm ?? "",
      meta: { label: "Who" },
      cell: ({ row }) => <ActorCell change={row.original} />,
    };
    const diff: ColumnDef<ChangeRow, unknown> = {
      id: "diff",
      header: "Diff",
      enableSorting: false,
      meta: { label: "Diff", className: "font-mono text-xs text-fg-muted" },
      cell: ({ row }) => <DiffCell change={row.original} />,
    };
    return scope === "all-hosts"
      ? [time, detected, change, host, path, who]
      : [time, detected, change, path, who, diff];
  }, [scope, detectionKey, detectedLabel]);

  return (
    <DataTable
      tableId={`fim-changes-${scope}-${detectionKey}-v2`}
      ariaLabel={scope === "all-hosts" ? "Recent file integrity changes, all hosts" : "Recent file integrity changes"}
      columns={columns}
      data={changes}
      getRowId={(c, index) => c.event_id ?? `${c.instance_id ?? "host"}-${c.path}-${index}`}
      initialSorting={[{ id: "time", desc: true }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Monitored paths and stray baselines (per instance)
// ---------------------------------------------------------------------------

export function FimPathsTable({ paths }: { paths: FimPathSummary[] }) {
  const columns = useMemo<ColumnDef<FimPathSummary, unknown>[]>(
    () => [
      {
        id: "category",
        header: "Category",
        accessorFn: (p) => p.category_label,
        meta: { label: "Category", className: "text-xs text-fg-muted" },
        cell: ({ row }) => row.original.category_label,
      },
      {
        id: "path",
        header: "Path",
        accessorFn: (p) => p.path,
        enableHiding: false,
        meta: { label: "Path", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.path,
      },
      {
        id: "files",
        header: "Files",
        accessorFn: (p) => p.file_count,
        sortDescFirst: true,
        meta: { label: "Files", className: `${NUMERIC} text-fg`, headerClassName: "text-right" },
        cell: ({ row }) => row.original.file_count,
      },
      {
        id: "size",
        header: "Total size",
        accessorFn: (p) => p.total_size_bytes,
        sortDescFirst: true,
        meta: { label: "Total size", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => formatBytes(row.original.total_size_bytes),
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="fim-paths-v2"
      ariaLabel="Monitored paths"
      columns={columns}
      data={paths}
      getRowId={(p) => `${p.category}-${p.path}`}
    />
  );
}

export function FimStrayTable({ stray }: { stray: FimStrayBaseline[] }) {
  const columns = useMemo<ColumnDef<FimStrayBaseline, unknown>[]>(
    () => [
      {
        id: "path",
        header: "Path",
        accessorFn: (s) => s.path,
        enableHiding: false,
        meta: { label: "Path", className: "break-all font-mono text-xs text-fg" },
        cell: ({ row }) => row.original.path,
      },
      {
        id: "size",
        header: "Size",
        accessorFn: (s) => s.size,
        sortDescFirst: true,
        meta: { label: "Size", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => formatBytes(row.original.size),
      },
      {
        id: "perm",
        header: "Perm",
        accessorFn: (s) => s.perm,
        meta: { label: "Perm", className: `${NUMERIC} text-fg-muted`, headerClassName: "text-right" },
        cell: ({ row }) => row.original.perm.toString(8).padStart(4, "0"),
      },
    ],
    [],
  );
  return (
    <DataTable
      tableId="fim-stray-v2"
      ariaLabel="Stray baselines"
      columns={columns}
      data={stray}
      getRowId={(s) => s.path}
    />
  );
}
