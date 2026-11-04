"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buildAttentionItems, isSystemItem, type AttentionItem } from "@/lib/attention";
import type { AgentIngressDiagnostics, ConnectorsListResponse, OverviewResponse } from "@/lib/types";

// Global "is the platform collecting data?" indicator for the top bar. Polls
// the same endpoints the Overview uses and runs them through the shared
// attention rules, so a silent agent or failing connector is visible from
// every page, not just its own.

type HealthState = "checking" | "ok" | "attention" | "unreachable";

const POLL_MS = 30_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return (await res.json()) as T;
}

export function SystemHealth() {
  const [state, setState] = useState<HealthState>("checking");
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [overview, connectors, ingress] = await Promise.allSettled([
      getJson<OverviewResponse>("/api/overview"),
      getJson<ConnectorsListResponse>("/api/connectors"),
      getJson<AgentIngressDiagnostics>("/api/agents/ingress?limit=1"),
    ]);
    // Every call failing means the backend (or our session) is the problem.
    if (overview.status === "rejected" && connectors.status === "rejected" && ingress.status === "rejected") {
      setState("unreachable");
      return;
    }
    const next = buildAttentionItems({
      overview: overview.status === "fulfilled" ? overview.value : null,
      connectors: connectors.status === "fulfilled" ? connectors.value : null,
      ingress: ingress.status === "fulfilled" ? ingress.value : null,
    }).filter(isSystemItem);
    setItems(next);
    setState(next.length > 0 ? "attention" : "ok");
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer !== null) return;
      void refresh();
      timer = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const worst = items[0]?.level;
  const dot =
    state === "ok"
      ? "bg-sev-resolved"
      : state === "unreachable"
        ? "bg-sev-critical"
        : state === "attention"
          ? worst === "critical" || worst === "high"
            ? "bg-sev-high"
            : "bg-sev-medium"
          : "bg-fg-subtle";
  const label =
    state === "ok"
      ? "Collecting"
      : state === "unreachable"
        ? "Backend unreachable"
        : state === "attention"
          ? `${items.length} ${items.length === 1 ? "issue" : "issues"}`
          : "Checking";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`System health: ${label}`}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 md:min-h-8"
      >
        <span aria-hidden="true" className={clsx("h-2 w-2 rounded-full", dot)} />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-1.5rem)] border border-line bg-surface-1 p-1 shadow-xl md:top-9">
          {state === "unreachable" && (
            <p className="px-3 py-3 text-sm text-fg-muted">
              The API did not answer. Data on this page may be out of date.
            </p>
          )}
          {state === "ok" && (
            <p className="px-3 py-3 text-sm text-fg-muted">
              All hosts, connectors and agent ingestion are reporting normally.
            </p>
          )}
          {state === "checking" && <p className="px-3 py-3 text-sm text-fg-muted">Checking…</p>}
          {state === "attention" &&
            items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
              >
                <span className="block text-sm text-fg">{item.title}</span>
                <span className="mt-0.5 block text-xs text-fg-muted">{item.detail}</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
