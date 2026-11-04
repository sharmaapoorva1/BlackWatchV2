"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, X } from "lucide-react";
import type { EventEnvelope } from "@/lib/types";
import { SeverityBadge } from "./SeverityBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { useAuth } from "@/components/auth/AuthProvider";

// Quick-look drawer for an event. Clicking an event link on any list opens
// this beside the list instead of navigating away, so filters, scroll position
// and auto-refresh context are kept. Modified clicks (ctrl/cmd/shift/middle)
// and the "Open full event" button still go to the real /events/[id] page,
// which stays the deep-linkable source of truth.

const PEEK_EVENT = "bw:peek-event";

export function peekEvent(eventId: string) {
  window.dispatchEvent(new CustomEvent<string>(PEEK_EVENT, { detail: eventId }));
}

/** Link to an event that opens the quick-look drawer on a plain click. */
export function EventLink({
  eventId,
  children,
  className,
}: {
  eventId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/events/${eventId}`}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        peekEvent(eventId);
      }}
    >
      {children}
    </Link>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; event: EventEnvelope };

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function tagList(event: EventEnvelope): string[] {
  const tags = event.tags;
  if (Array.isArray(tags)) return tags.filter((tag): tag is string => typeof tag === "string");
  if (tags && typeof tags === "object") {
    return Object.entries(tags as Record<string, unknown>).map(([key, value]) => `${key}=${String(value)}`);
  }
  return [];
}

export function EventPeekHost() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const onPeek = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (typeof id === "string" && id) setEventId(id);
    };
    window.addEventListener(PEEK_EVENT, onPeek);
    return () => window.removeEventListener(PEEK_EVENT, onPeek);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/events/${encodeURIComponent(eventId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) throw new Error("This event no longer exists.");
        if (!res.ok) throw new Error(`The API returned ${res.status}.`);
        return (await res.json()) as EventEnvelope;
      })
      .then((event) => setState({ status: "ready", event }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Could not load the event." });
      });
    return () => controller.abort();
  }, [eventId]);

  return (
    <Dialog.Root open={eventId !== null} onOpenChange={(open) => !open && setEventId(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-black/50" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-[56] flex w-[min(30rem,100vw)] flex-col border-l border-line bg-surface-1 shadow-2xl focus:outline-none"
          aria-describedby="event-peek-desc"
        >
          <div className="flex items-start gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="break-all font-mono text-sm text-fg">
                {state.status === "ready" ? state.event.action : "Event"}
              </Dialog.Title>
              <Dialog.Description id="event-peek-desc" className="mt-1 text-xs text-fg-muted">
                Quick look. Open the full event for the raw payload.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close event details"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:h-8 sm:w-8"
            >
              <X size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {state.status === "loading" && <PeekSkeleton />}
            {state.status === "error" && (
              <p role="alert" className="text-sm text-sev-critical">{state.message}</p>
            )}
            {state.status === "ready" && <PeekBody event={state.event} onNavigate={() => setEventId(null)} />}
          </div>

          {eventId && (
            <div className="border-t border-line px-4 py-3">
              <Link
                href={`/events/${eventId}`}
                onClick={() => setEventId(null)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-8"
              >
                Open full event <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PeekSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading event">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="h-5 animate-pulse rounded bg-surface-2" />
      ))}
    </div>
  );
}

function PeekBody({ event, onNavigate }: { event: EventEnvelope; onNavigate: () => void }) {
  const actor = (event.actor ?? {}) as Record<string, unknown>;
  const target = (event.target ?? {}) as Record<string, unknown>;
  const principal = str(actor.principal);
  const sourceIp = str(actor.source_ip);
  const targetId = str(target.id);
  const targetName = str(target.name);
  const moduleName = str(event.source?.module);
  const message = str(event.message) ?? str((event.extra as Record<string, unknown> | undefined)?.message);
  const tags = tagList(event);
  const rules = Array.isArray(event.rule_matches) ? event.rule_matches : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <SeverityBadge severity={(event.severity as string | null | undefined) ?? null} />
        {event.outcome && <span className="text-fg-muted">Outcome: {event.outcome}</span>}
        <time dateTime={event.event_time} className="font-mono text-xs text-fg-muted">
          {new Date(event.event_time).toLocaleString()}
        </time>
      </div>

      {message && <p className="text-sm text-fg">{message}</p>}

      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <Row label="Module" value={moduleName} />
        <Row label="Category" value={str(event.category)} />
        <Row label="Actor" value={principal} copy />
        <Row label="Source IP" value={sourceIp} copy />
        <Row label="Target" value={targetName ?? targetId} copy />
        {targetName && targetId && targetName !== targetId && <Row label="Target ID" value={targetId} copy />}
        <Row label="Target type" value={str(target.type)} />
        <Row label="Event ID" value={event.event_id} copy />
      </dl>

      {rules.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-medium text-fg-muted">Rules matched</h3>
          <ul className="flex flex-wrap gap-1.5">
            {rules.map((rule) => (
              <li key={rule} className="border border-line-soft bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted">{rule}</li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-medium text-fg-muted">Tags</h3>
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag} className="border border-line-soft bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted">{tag}</li>
            ))}
          </ul>
        </section>
      )}

      <SilenceAction fingerprint={str(event.dedup_fingerprint)} action={event.action} />

      <section>
        <h3 className="mb-1.5 text-xs font-medium text-fg-muted">Pivot</h3>
        <ul className="flex flex-wrap gap-2">
          {principal && <Pivot href={`/events?q=${encodeURIComponent(principal)}`} label="Events by this actor" onNavigate={onNavigate} />}
          {sourceIp && <Pivot href={`/events?q=${encodeURIComponent(sourceIp)}`} label="Events from this IP" onNavigate={onNavigate} />}
          {sourceIp && <Pivot href={`/tools/ip-lookup?ip=${encodeURIComponent(sourceIp)}`} label="Look up IP" onNavigate={onNavigate} />}
          {targetId && <Pivot href={`/events?q=${encodeURIComponent(targetId)}`} label="Events on this target" onNavigate={onNavigate} />}
          {event.action && <Pivot href={`/events?action=${encodeURIComponent(event.action)}`} label="Same action" onNavigate={onNavigate} />}
          {moduleName && <Pivot href={`/events?module=${encodeURIComponent(moduleName)}`} label="Same module" onNavigate={onNavigate} />}
          {targetId?.startsWith("i-") && <Pivot href={`/hosts/${encodeURIComponent(targetId)}`} label="Open host" onNavigate={onNavigate} />}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value, copy = false }: { label: string; value: string | null; copy?: boolean }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 break-all font-mono text-xs text-fg">{value}</span>
        {copy && <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />}
      </dd>
    </>
  );
}

function Pivot({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="inline-flex min-h-11 items-center border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-signal hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-8"
      >
        {label}
      </Link>
    </li>
  );
}

const SILENCE_HOURS = [1, 4, 24] as const;

// Acknowledge = stop notifying about this event's fingerprint for a while. The
// event is still stored and scored; only the outgoing alerts are paused. It is
// admin-only on the server too, and always expires. (Muting an action at
// ingest, which drops events, is deliberately not offered here.)
function SilenceAction({ fingerprint, action }: { fingerprint: string | null; action: string }) {
  const { role, loading } = useAuth();
  const [hours, setHours] = useState<number>(4);
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!fingerprint || loading || role !== "admin") return null;

  async function silence() {
    setStatus("pending");
    setError(null);
    try {
      const res = await fetch("/api/notifications/acks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fingerprint, hours, reason: `Acknowledged from event view (${action})` }),
      });
      if (!res.ok) throw new Error(`The API returned ${res.status}.`);
      setStatus("done");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Could not silence notifications.");
      setStatus("error");
    }
  }

  return (
    <section>
      <h3 className="mb-1.5 text-xs font-medium text-fg-muted">Acknowledge</h3>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="silence-hours">Silence duration</label>
        <select
          id="silence-hours"
          value={hours}
          onChange={(event) => {
            setHours(Number(event.target.value));
            setStatus("idle");
          }}
          className="min-h-11 border border-line bg-surface-2 px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-8"
        >
          {SILENCE_HOURS.map((value) => (
            <option key={value} value={value}>{value === 1 ? "1 hour" : `${value} hours`}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={silence}
          disabled={status === "pending"}
          className="inline-flex min-h-11 cursor-pointer items-center border border-line px-3 text-sm text-fg transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8"
        >
          {status === "pending" ? "Silencing…" : "Silence notifications for this event"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-fg-subtle" role={status === "error" ? "alert" : "status"}>
        {status === "done"
          ? `Notifications for this event are silenced for ${hours} ${hours === 1 ? "hour" : "hours"}. The event is still recorded.`
          : status === "error"
            ? error
            : "Pauses alerts for repeats of this event. It is still stored and scored."}
      </p>
    </section>
  );
}
