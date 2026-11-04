"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cancelConnectorOperationAction, getConnectorOperationsAction } from "@/app/connectors/actions";
import type { ConnectorOperation, ConnectorProgress } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { DataPanel } from "@/components/layout/DataPanel";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

function progressOf(operation: ConnectorOperation): ConnectorProgress {
  const value = operation.outcome?.progress;
  if (value && typeof value === "object") return value as ConnectorProgress;
  const outcome = operation.outcome ?? {};
  return {
    stage: operation.status === "succeeded" ? "completed" : operation.status,
    fetched: typeof outcome.messages === "number" ? outcome.messages : 0,
    ingested: typeof outcome.ingested === "number" ? outcome.ingested : 0,
  };
}

function time(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function eventLines(operation: ConnectorOperation): Record<string, unknown>[] {
  const events = operation.outcome?.recent_events;
  return Array.isArray(events) ? (events as Record<string, unknown>[]) : [];
}

function EventLog({ events, summary, maxHeight }: { events: Record<string, unknown>[]; summary: string; maxHeight: string }) {
  if (events.length === 0) return null;
  return (
    <details className="mt-1 font-sans text-xs text-fg-muted">
      <summary className="cursor-pointer">{summary}</summary>
      <ol className={`mt-1 ${maxHeight} space-y-0.5 overflow-auto pl-4`}>
        {events.map((event, index) => (
          <li key={index}>
            {String(event.stage ?? "event")} · {String(event.message_id ?? event.action ?? "—")}
          </li>
        ))}
      </ol>
    </details>
  );
}

const ACTIVE_COLUMNS: ColumnDef<ConnectorOperation, unknown>[] = [
  {
    id: "connector",
    header: "Connector",
    accessorFn: (op) => op.connector_name ?? "",
    enableHiding: false,
    meta: { label: "Connector", className: "font-medium" },
    cell: ({ row }) => row.original.connector_name ?? "—",
  },
  {
    id: "operation",
    header: "Operation",
    accessorFn: (op) => op.operation_id,
    meta: { label: "Operation", className: "font-mono text-xs" },
    cell: ({ row }) => row.original.operation_id.slice(0, 8),
  },
  {
    id: "stage",
    header: "Stage",
    accessorFn: (op) => progressOf(op).stage ?? "starting",
    meta: { label: "Stage" },
    cell: ({ row }) => progressOf(row.original).stage ?? "starting",
  },
  {
    id: "message",
    header: "Message",
    enableSorting: false,
    meta: { label: "Message", className: "max-w-64 font-mono text-xs" },
    cell: ({ row }) => {
      const progress = progressOf(row.original);
      const events = eventLines(row.original);
      return (
        <>
          <div className="truncate" title={progress.message_id ?? undefined}>
            {progress.action ?? progress.message_id ?? "—"}
          </div>
          <EventLog events={events} summary={`${events.length} log events`} maxHeight="max-h-32" />
        </>
      );
    },
  },
  {
    id: "fetched",
    header: "Fetched",
    accessorFn: (op) => progressOf(op).fetched ?? 0,
    sortDescFirst: true,
    meta: { label: "Fetched", className: "tabular-nums" },
    cell: ({ row }) => progressOf(row.original).fetched ?? 0,
  },
  {
    id: "ingested",
    header: "Ingested",
    accessorFn: (op) => progressOf(op).ingested ?? 0,
    sortDescFirst: true,
    meta: { label: "Ingested", className: "tabular-nums" },
    cell: ({ row }) => progressOf(row.original).ingested ?? 0,
  },
  {
    id: "failed",
    header: "Failed",
    accessorFn: (op) => progressOf(op).failed ?? 0,
    sortDescFirst: true,
    meta: { label: "Failed", className: "tabular-nums" },
    cell: ({ row }) => progressOf(row.original).failed ?? 0,
  },
  {
    id: "deleted",
    header: "Deleted",
    accessorFn: (op) => progressOf(op).deleted ?? 0,
    sortDescFirst: true,
    meta: { label: "Deleted", className: "tabular-nums" },
    cell: ({ row }) => progressOf(row.original).deleted ?? 0,
  },
  {
    id: "started",
    header: "Started",
    accessorFn: (op) => (op.started_at ? Date.parse(op.started_at) || 0 : 0),
    sortDescFirst: true,
    meta: { label: "Started", className: "whitespace-nowrap text-xs" },
    cell: ({ row }) => time(row.original.started_at),
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (op) => op.status,
    meta: { label: "Status" },
    cell: ({ row }) => <StatusPill severity="neutral" label={row.original.status} />,
  },
  {
    id: "control",
    header: "Control",
    enableSorting: false,
    enableHiding: false,
    meta: { label: "Control", isActions: true },
    cell: ({ row }) =>
      row.original.status === "queued" ? (
        <Button
          size="sm"
          variant="danger"
          onClick={() => void cancelConnectorOperationAction(row.original.operation_id)}
        >
          Stop
        </Button>
      ) : null,
  },
];

const HISTORY_COLUMNS: ColumnDef<ConnectorOperation, unknown>[] = [
  {
    id: "connector",
    header: "Connector",
    accessorFn: (op) => op.connector_name ?? "",
    enableHiding: false,
    meta: { label: "Connector", className: "font-medium" },
    cell: ({ row }) => row.original.connector_name ?? "—",
  },
  {
    id: "operation",
    header: "Operation",
    accessorFn: (op) => op.operation_id,
    meta: { label: "Operation", className: "font-mono text-xs" },
    cell: ({ row }) => row.original.operation_id.slice(0, 8),
  },
  {
    id: "requested",
    header: "Requested",
    accessorFn: (op) => (op.requested_at ? Date.parse(op.requested_at) || 0 : 0),
    sortDescFirst: true,
    meta: { label: "Requested", className: "whitespace-nowrap text-xs" },
    cell: ({ row }) => time(row.original.requested_at),
  },
  {
    id: "finished",
    header: "Finished",
    accessorFn: (op) => (op.finished_at ? Date.parse(op.finished_at) || 0 : 0),
    sortDescFirst: true,
    meta: { label: "Finished", className: "whitespace-nowrap text-xs" },
    cell: ({ row }) => time(row.original.finished_at),
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (op) => op.status,
    meta: { label: "Status" },
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <StatusPill
          severity={status === "succeeded" ? "resolved" : status === "failed" || status === "timed_out" ? "critical" : "neutral"}
          label={status}
        />
      );
    },
  },
  {
    id: "progress",
    header: "Progress / error",
    enableSorting: false,
    meta: { label: "Progress / error", className: "max-w-[34rem] text-xs text-fg-muted" },
    cell: ({ row }) => {
      const operation = row.original;
      const progress = progressOf(operation);
      const events = eventLines(operation);
      return (
        <>
          {operation.error_message ??
            `${progress.stage ?? "completed"} · ${progress.fetched ?? 0} fetched · ${progress.ingested ?? 0} ingested · ${events.length} events`}
          <EventLog events={events} summary="Show ordered log" maxHeight="max-h-24" />
        </>
      );
    },
  },
];

export function AdvancedQueueView({ initial }: { initial: ConnectorOperation[] }) {
  const [operations, setOperations] = useState(initial);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await getConnectorOperationsAction();
      if (cancelled || !result) return;
      const next = result.operations;
      if (Array.isArray(next)) setOperations(next as ConnectorOperation[]);
      if (typeof result.generated_at === "string") setLastRefresh(result.generated_at);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const active = useMemo(
    () => operations.filter((operation) => operation.status === "queued" || operation.status === "running"),
    [operations],
  );
  const recent = useMemo(
    () => operations.filter((operation) => operation.status !== "queued" && operation.status !== "running").slice(0, 30),
    [operations],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-muted">
        <span>{active.length} active operation{active.length === 1 ? "" : "s"} · updates every 2 seconds</span>
        <span>{lastRefresh ? `updated ${time(lastRefresh)}` : "connecting…"}</span>
      </div>
      <DataPanel className="overflow-hidden">
        <DataTable
          tableId="advanced-queue-active-v2"
          ariaLabel="Active connector operations"
          columns={ACTIVE_COLUMNS}
          data={active}
          getRowId={(operation) => operation.operation_id}
          emptyMessage="No queued or running operations."
        />
      </DataPanel>
      <DataPanel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Recent operation log</h2>
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()}><RefreshCw size={14} /> Refresh</Button>
        </div>
        <DataTable
          tableId="advanced-queue-history-v2"
          ariaLabel="Recent connector operation log"
          columns={HISTORY_COLUMNS}
          data={recent}
          getRowId={(operation) => operation.operation_id}
          emptyMessage="No finished operations yet."
        />
      </DataPanel>
    </div>
  );
}
