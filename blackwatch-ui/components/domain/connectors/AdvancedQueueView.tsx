"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cancelConnectorOperationAction, getConnectorOperationsAction } from "@/app/connectors/actions";
import type { ConnectorOperation, ConnectorProgress } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { DataPanel } from "@/components/layout/DataPanel";
import { StatusPill } from "@/components/ui/StatusPill";
import { Table } from "@/components/ui/Table";

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
        <Table tableId="advanced-queue-active" ariaLabel="Active connector operations">
          <thead><tr>
            <th>Connector</th><th>Operation</th><th>Stage</th><th>Message</th><th>Fetched</th><th>Ingested</th><th>Failed</th><th>Deleted</th><th>Started</th><th>Status</th><th>Control</th>
          </tr></thead>
          <tbody>{active.length ? active.map((operation) => {
            const progress = progressOf(operation);
            return <tr key={operation.operation_id}>
              <td className="font-medium">{operation.connector_name ?? "—"}</td><td className="font-mono text-xs">{operation.operation_id.slice(0, 8)}</td>
              <td>{progress.stage ?? "starting"}</td>
              <td className="max-w-64 font-mono text-xs">
                <div className="truncate" title={progress.message_id ?? undefined}>{progress.action ?? progress.message_id ?? "—"}</div>
                {Array.isArray(operation.outcome?.recent_events) && operation.outcome.recent_events.length > 0 && <details className="mt-1 font-sans text-[11px] text-fg-muted">
                  <summary className="cursor-pointer">{operation.outcome.recent_events.length} log events</summary>
                  <ol className="mt-1 max-h-32 space-y-0.5 overflow-auto pl-4">
                    {operation.outcome.recent_events.map((event, index) => <li key={index}>{String((event as Record<string, unknown>).stage ?? "event")} · {String((event as Record<string, unknown>).message_id ?? (event as Record<string, unknown>).action ?? "—")}</li>)}
                  </ol>
                </details>}
              </td>
              <td>{progress.fetched ?? 0}</td><td>{progress.ingested ?? 0}</td><td>{progress.failed ?? 0}</td><td>{progress.deleted ?? 0}</td>
              <td className="whitespace-nowrap text-xs">{time(operation.started_at)}</td>
              <td><StatusPill severity="neutral" label={operation.status} /></td>
              <td>{operation.status === "queued" && <Button size="sm" variant="danger" onClick={() => void cancelConnectorOperationAction(operation.operation_id)}>Stop</Button>}</td>
            </tr>;
          }) : <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-fg-muted">No queued or running operations.</td></tr>}</tbody>
        </Table>
      </DataPanel>
      <DataPanel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Recent operation log</h2>
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()}><RefreshCw size={14} /> Refresh</Button>
        </div>
        <Table tableId="advanced-queue-history" ariaLabel="Recent connector operation log">
          <thead><tr><th>Connector</th><th>Operation</th><th>Requested</th><th>Finished</th><th>Status</th><th>Progress / error</th></tr></thead>
          <tbody>{recent.map((operation) => {
            const progress = progressOf(operation);
            const recentEvents = Array.isArray(operation.outcome?.recent_events) ? operation.outcome.recent_events : [];
            return <tr key={operation.operation_id}>
              <td className="font-medium">{operation.connector_name ?? "—"}</td><td className="font-mono text-xs">{operation.operation_id.slice(0, 8)}</td>
              <td className="whitespace-nowrap text-xs">{time(operation.requested_at)}</td>
              <td className="whitespace-nowrap text-xs">{time(operation.finished_at)}</td>
              <td><StatusPill severity={operation.status === "succeeded" ? "resolved" : operation.status === "failed" || operation.status === "timed_out" ? "critical" : "neutral"} label={operation.status} /></td>
              <td className="max-w-[34rem] text-xs text-fg-muted">
                {operation.error_message ?? `${progress.stage ?? "completed"} · ${progress.fetched ?? 0} fetched · ${progress.ingested ?? 0} ingested · ${recentEvents.length} events`}
                {recentEvents.length > 0 && <details className="mt-1"><summary className="cursor-pointer">Show ordered log</summary><ol className="mt-1 max-h-24 space-y-0.5 overflow-auto pl-4">{recentEvents.map((event, index) => <li key={index}>{String((event as Record<string, unknown>).stage ?? "event")} · {String((event as Record<string, unknown>).message_id ?? (event as Record<string, unknown>).action ?? "—")}</li>)}</ol></details>}
              </td>
            </tr>;
          })}</tbody>
        </Table>
      </DataPanel>
    </div>
  );
}
