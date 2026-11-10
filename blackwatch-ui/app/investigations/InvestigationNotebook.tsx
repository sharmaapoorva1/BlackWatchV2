"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Network,
  ScanSearch,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import type {
  InvestigationDetail,
  InvestigationResult,
  InvestigationStatus,
} from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Textarea } from "@/components/ui/Textarea";
import { DataPanel } from "@/components/layout/DataPanel";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import { SeverityBadge } from "@/components/domain/SeverityBadge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/layout/Section";
import { Subsection, EXPAND_EVENT } from "@/components/layout/Subsection";
import { DetailLayout } from "@/components/layout/DetailLayout";
import { StickyHeader } from "@/components/layout/StickyHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { NavGroup } from "@/components/layout/SectionNav";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatStatus } from "./InvestigationList";
import { InvestigationIpIntelligence } from "./InvestigationIpIntelligence";

const STATUSES: InvestigationStatus[] = [
  "ready",
  "investigating",
  "contained",
  "confirmed_malicious",
  "confirmed_expected",
  "false_positive",
  "inconclusive",
  "closed",
];

type EvidenceView = "timeline" | "module" | "table";

const MODULE_NAMES: Record<string, string> = {
  api: "API Gateway",
  rds: "RDS",
  vpn: "VPN",
  host: "EC2 / Hosts",
  s3: "S3",
  "aws.posture": "AWS posture",
  fim: "File integrity",
};

export function InvestigationNotebook({
  initial,
}: {
  initial: InvestigationDetail;
}) {
  const [data, setData] = useState(initial);
  const [note, setNote] = useState("");
  const [view, setView] = useState<EvidenceView>("module");
  const [focusedModule, setFocusedModule] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(() =>
    rangeDays(initial.time_start, initial.time_end),
  );
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const ip =
    data.observables.find((value) => value.startsWith("ip:"))?.slice(3) ?? "";
  const scanning =
    data.scan?.status === "queued" ||
    data.scan?.status === "running" ||
    data.status === "investigating";

  useEffect(() => {
    if (!scanning) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/investigations/${data.id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) setData(await response.json());
    }, 1500);
    return () => window.clearInterval(timer);
  }, [data.id, scanning]);

  function request(path: string, init: RequestInit) {
    return fetch(`/api/investigations/${data.id}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }

  function scan() {
    setMessage(null);
    startTransition(async () => {
      const response = await request("/scan", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.detail ?? "Investigation scan failed");
        return;
      }
      const refreshed = await fetch(`/api/investigations/${data.id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (refreshed.ok) setData(await refreshed.json());
      setMessage("Scan queued. This page will update as evidence is found.");
    });
  }

  function changeStatus(status: InvestigationStatus) {
    startTransition(async () => {
      const response = await request("/status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        const updated = await response.json();
        setData((current) => ({ ...current, ...updated }));
      }
    });
  }

  function changeWindow(days: number) {
    setWindowDays(days);
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    startTransition(async () => {
      const response = await request("/range", {
        method: "PATCH",
        body: JSON.stringify({
          time_start: start.toISOString(),
          time_end: end.toISOString(),
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setData((current) => ({ ...current, ...updated }));
      }
    });
  }

  function addNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      const response = await request("/notes", {
        method: "POST",
        body: JSON.stringify({ body: note }),
      });
      if (response.ok) {
        const created = await response.json();
        setData((current) => ({
          ...current,
          notes: [created, ...current.notes],
        }));
        setNote("");
      }
    });
  }

  const summary = useMemo(() => buildSummary(data.results), [data.results]);
  const nav: NavGroup[] = [
    { id: "summary", label: "Summary" },
    ...(ip ? [{ id: "intelligence", label: "IP intelligence" }] : []),
    {
      id: "evidence",
      label: "Evidence",
      items: [
        { id: "evidence-chain", label: "Evidence chain", count: summary.modules.length },
        { id: "evidence-pulse", label: "Activity over time", count: data.results.length },
        { id: "evidence-detail", label: "Evidence detail", count: data.results.length },
      ],
    },
    { id: "next-steps", label: "What to check next" },
    { id: "notes", label: "Notes", count: data.notes.length },
  ];

  return (
    <>
      <StickyHeader>
        <Breadcrumbs items={[{ label: "Investigations", href: "/investigations" }, { label: data.title }]} />
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h1 className="min-w-0 break-words font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            {data.title}
          </h1>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Status" compact className="w-48">
              <NativeSelect
                value={data.status}
                onChange={(event) => changeStatus(event.target.value as InvestigationStatus)}
                disabled={busy}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Time window" compact className="w-40">
              <NativeSelect value={String(windowDays)} onChange={(event) => changeWindow(Number(event.target.value))}>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </NativeSelect>
            </Field>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={scan}
              disabled={busy || scanning || data.status === "closed"}
            >
              {scanning ? "Scanning…" : "Run investigation"}
            </Button>
          </div>
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          {ip && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-fg-subtle">Observable</span>
              <IpCell value={ip} className="text-xs text-fg" />
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-fg-subtle">Priority</span>
            <span className="text-fg">{data.priority}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-fg-subtle">Owner</span>
            <span className="text-fg-muted">{data.owner}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-fg-subtle">Window</span>
            <span className="text-fg-muted">
              {new Date(data.time_start).toLocaleDateString()} to {new Date(data.time_end).toLocaleDateString()}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-fg-subtle">Evidence</span>
            <span className="font-mono text-fg">{data.results.length}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-fg-subtle">Case</span>
            <code className="font-mono text-fg-muted">{data.id}</code>
          </span>
          {scanning && (
            <span role="status" className="inline-flex items-center gap-1.5 text-signal">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" aria-hidden="true" />
              Collecting evidence…
            </span>
          )}
        </div>
      </StickyHeader>

      <DetailLayout nav={nav}>
        {message && (
          <div role="status" className="rounded-md border border-line-soft bg-surface-1 px-3 py-2 text-xs text-fg-muted">
            {message}
          </div>
        )}
        {data.scan?.status === "failed" && (
          <div role="alert" className="rounded-md border border-sev-critical/40 bg-sev-critical/5 px-3 py-2 text-xs text-sev-critical">
            Scan failed: {data.scan.error ?? "unknown error"}
          </div>
        )}

        <Section id="summary" title="Summary" description="What the evidence says so far.">
          <InvestigationBrief ip={ip} results={data.results} scanning={scanning} />
        </Section>

        {ip && (
          <Section id="intelligence" title="IP intelligence" description="Provider and local-feed context for the observable.">
            <InvestigationIpIntelligence ip={ip} />
          </Section>
        )}

        <Section id="evidence" title="Evidence" description="Where this observable appears and when. Correlation, not causation.">
          <Subsection id="evidence-chain" title="Evidence chain" count={summary.modules.length} summary="where it appears across modules">
            <EvidenceChain
              results={data.results}
              onReviewEvidence={(moduleName) => {
                setView("module");
                setFocusedModule(moduleName);
                window.dispatchEvent(new CustomEvent<string>(EXPAND_EVENT, { detail: "evidence-detail" }));
                const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                window.requestAnimationFrame(() => {
                  document.getElementById("evidence-detail")?.scrollIntoView({
                    behavior: reduceMotion ? "auto" : "smooth",
                    block: "start",
                  });
                });
              }}
            />
          </Subsection>
          <Subsection id="evidence-pulse" title="Activity over time" count={data.results.length} summary="when the linked evidence appeared">
            <ActivityGraph results={data.results} />
          </Subsection>
          <Subsection id="evidence-detail" title="Evidence detail" count={data.results.length} summary="open the underlying records to verify a link">
            <EvidenceExplorer
              results={data.results}
              view={view}
              setView={setView}
              focusedModule={focusedModule}
              setFocusedModule={setFocusedModule}
            />
          </Subsection>
        </Section>

        <Section id="next-steps" title="What to check next" description="Investigation steps, not automated remediation.">
          <InvestigationActions results={data.results} ip={ip} />
        </Section>

        <Section id="notes" title="Notes" description="Record what you checked and why. Notes are part of the case record.">
          <DataPanel className="space-y-3 p-4">
            <Field label="Add a note">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                maxLength={10000}
                placeholder="What did you check, and what did you conclude?"
              />
            </Field>
            <Button type="button" size="sm" onClick={addNote} disabled={busy || !note.trim()}>
              Add note
            </Button>
          </DataPanel>
          {data.notes.length > 0 && (
            <ul className="space-y-3">
              {data.notes.map((item) => (
                <li key={item.id} className="rounded-md border border-line-soft bg-surface-1 p-4">
                  <div className="text-xs text-fg-subtle">
                    {item.author} · <TimestampCell value={item.created_at} />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </DetailLayout>
    </>
  );
}

function InvestigationBrief({
  ip,
  results,
  scanning,
}: {
  ip: string;
  results: InvestigationResult[];
  scanning: boolean;
}) {
  const summary = useMemo(() => buildSummary(results), [results]);
  return (
      <DataPanel className="overflow-hidden">
        <div className="space-y-5 px-5 py-5">
          <div>
            <h3 className="max-w-3xl text-lg font-medium leading-snug text-fg">
              {summary.headline}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">
              {summary.narrative}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StoryFact icon={<Waypoints size={14} />} label="evidence" value={`${results.length} matches`} />
            <StoryFact icon={<Network size={14} />} label="linked modules" value={`${summary.modules.length} sources`} />
            <StoryFact icon={<Clock3 size={14} />} label="first seen" value={summary.firstSeen ? formatShortDate(summary.firstSeen) : "—"} />
            <StoryFact icon={<CircleAlert size={14} />} label="highest signal" value={summary.highestSeverity} severity={summary.highestSeverity} />
          </div>
          {scanning && (
            <div className="flex items-center gap-2 border border-signal/30 bg-signal/5 px-3 py-2 text-xs text-fg-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" aria-hidden="true" />
              The evidence trail is still being assembled. New links will appear automatically.
            </div>
          )}
        </div>
      </DataPanel>
  );
}

function EvidenceChain({
  results,
  onReviewEvidence,
}: {
  results: InvestigationResult[];
  onReviewEvidence: (moduleName: string) => void;
}) {
  const summary = useMemo(() => buildSummary(results), [results]);

  return (
    <>
        {summary.modules.length === 0 ? (
          <DataPanel className="px-5 py-8 text-center text-sm text-fg-muted">
            Run the investigation to build the evidence chain.
          </DataPanel>
        ) : (
          <DataPanel className="overflow-hidden">
            <div className="overflow-x-auto p-3">
              <div className="flex min-w-max items-stretch gap-3 md:min-w-0">
            {summary.modules.map((module, index) => (
              <div key={module.name} className="flex min-w-[15rem] flex-1 items-center gap-3 md:min-w-0">
                <div className="min-w-0 flex-1 border border-line-soft bg-canvas/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-fg">{module.name}</div>
                      <div className="mt-1 text-xs text-fg-subtle">
                        {module.count} linked {module.count === 1 ? "entry" : "entries"}
                      </div>
                    </div>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-1 font-mono text-xs text-signal">
                      {index + 1}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 text-fg-muted">
                      <span>strongest signal</span>
                      <SeverityBadge severity={module.highestSeverity} />
                    </div>
                    <div className="break-words text-fg-muted">
                      <span className="text-fg-subtle">activity · </span>{module.topAction}
                    </div>
                    <Button
                      size="sm" variant="ghost"
                      type="button"
                      onClick={() => onReviewEvidence(module.name)}
                      aria-controls="evidence-detail"
                      className="mt-3 inline-flex items-center gap-1 text-left text-xs text-signal hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                    >
                      review evidence <ArrowRight size={12} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {index < summary.modules.length - 1 && (
                  <ArrowRight className="mt-12 hidden shrink-0 text-fg-disabled md:block" size={16} aria-hidden="true" />
                )}
              </div>
            ))}
              </div>
            </div>
          </DataPanel>
        )}
    </>
  );
}

function InvestigationActions({
  results,
  ip,
}: {
  results: InvestigationResult[];
  ip: string;
}) {
  const actions = useMemo(() => buildActions(results, ip), [ip, results]);
  return (
      <>
        <div className="grid gap-2 md:grid-cols-2">
          {actions.map((action) => (
            <DataPanel key={action.title} className="flex gap-3 p-4">
              <div className="mt-0.5 shrink-0 text-signal">{action.icon}</div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-fg">{action.title}</h3>
                <p className="mt-1 text-xs leading-5 text-fg-muted">{action.body}</p>
              </div>
            </DataPanel>
          ))}
        </div>
      </>
  );
}

function EvidenceExplorer({
  results,
  view,
  setView,
  focusedModule,
  setFocusedModule,
}: {
  results: InvestigationResult[];
  view: EvidenceView;
  setView: (value: EvidenceView) => void;
  focusedModule: string | null;
  setFocusedModule: (value: string | null) => void;
}) {
  const sorted = useMemo(
    () => [...results].sort((a, b) => dateValue(b) - dateValue(a)),
    [results],
  );
  const groups = useMemo(() => {
    const names = Array.from(new Set(sorted.map(moduleLabel)));
    return names.map((name) => ({
      name,
      items: sorted.filter((item) => moduleLabel(item) === name),
    }));
  }, [sorted]);

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <Field label="View" compact className="w-44">
          <NativeSelect value={view} onChange={(event) => setView(event.target.value as EvidenceView)}>
            <option value="module">By module</option>
            <option value="timeline">Timeline</option>
            <option value="table">Evidence table</option>
          </NativeSelect>
        </Field>
      </div>
      <DataPanel className="overflow-hidden">
        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-muted">
            No linked evidence yet. Run the investigation to search normalized events and projection tables.
          </p>
        ) : view === "timeline" ? (
          <EvidenceTimeline results={sorted} />
        ) : view === "table" ? (
          <EvidenceTable results={sorted} tableId="investigation-evidence-all" />
        ) : (
          <div className="p-3">
            {groups.map((group) => (
              <CollapsibleSection
                key={group.name}
                storageKey={`bw-investigation-module-${group.name}`}
                title={group.name}
                subtitle="linked records"
                count={group.items.length}
                open={focusedModule === null ? undefined : focusedModule === group.name}
                onOpenChange={(open) => {
                  if (open) setFocusedModule(group.name);
                  else if (focusedModule === group.name) setFocusedModule(null);
                }}
              >
                <EvidenceTable
                  results={group.items}
                  tableId={`investigation-evidence-${group.name}`}
                />
              </CollapsibleSection>
            ))}
          </div>
        )}
      </DataPanel>
    </section>
  );
}

function EvidenceTimeline({ results }: { results: InvestigationResult[] }) {
  return (
    <div className="divide-y divide-line-soft">
      {results.map((result, index) => {
        const event = result.event;
        return (
          <article key={`${result.event_id ?? result.source_label}-${index}`} className="relative grid min-w-0 gap-3 px-5 py-4 sm:grid-cols-[minmax(6rem,8rem)_minmax(0,1fr)_auto]">
            <div className="flex items-start gap-2 text-xs text-fg-muted">
              <Clock3 size={13} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
              <TimestampCell value={event.event_time ?? result.observed_at ?? ""} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-fg">{event.action ?? "Related activity"}</span>
                <span className="font-mono text-xs text-signal">{moduleLabel(result)}</span>
                <SeverityBadge severity={event.severity} />
              </div>
              <p className="mt-1 break-words text-xs text-fg-muted">
                {event.target?.id ?? event.target?.name ?? "Observable found in module evidence"}
              </p>
              <p className="mt-2 break-words text-xs leading-5 text-fg-subtle">{result.match_reason}</p>
            </div>
            <EvidenceLink result={result} />
          </article>
        );
      })}
    </div>
  );
}

function EvidenceTable({
  results,
  tableId,
}: {
  results: InvestigationResult[];
  tableId: string;
}) {
  const columns = useMemo<ColumnDef<InvestigationResult, unknown>[]>(
    () => [
      {
        id: "time",
        header: "Time",
        accessorFn: (result) => Date.parse(result.event.event_time ?? result.observed_at ?? "") || 0,
        sortDescFirst: true,
        enableHiding: false,
        meta: { label: "Time", className: "whitespace-nowrap" },
        cell: ({ row }) => <TimestampCell value={row.original.event.event_time ?? row.original.observed_at ?? ""} />,
      },
      {
        id: "event",
        header: "Event",
        accessorFn: (result) => result.event.action ?? "Related activity",
        meta: { label: "Event" },
        cell: ({ row }) => (
          <>
            <div className="max-w-[22rem] break-words text-fg">{row.original.event.action ?? "Related activity"}</div>
            <div className="mt-1 font-mono text-xs text-fg-subtle">{moduleLabel(row.original)}</div>
          </>
        ),
      },
      {
        id: "target",
        header: "Target / observable",
        accessorFn: (result) => result.event.target?.id ?? result.event.target?.name ?? "",
        meta: { label: "Target / observable", className: "max-w-[20rem] break-words font-mono text-xs" },
        cell: ({ row }) => row.original.event.target?.id ?? row.original.event.target?.name ?? "—",
      },
      {
        id: "why",
        header: "Why it matters",
        accessorFn: (result) => result.match_reason,
        meta: { label: "Why it matters", className: "max-w-[26rem] break-words text-xs text-fg-muted" },
        cell: ({ row }) => row.original.match_reason,
      },
      {
        id: "details",
        header: "Details",
        enableSorting: false,
        meta: { label: "Details" },
        cell: ({ row }) => <EvidenceLink result={row.original} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId={`${tableId}-v2`}
      ariaLabel="Related evidence"
      columns={columns}
      data={results}
      getRowId={(result, index) => `${result.event_id ?? result.source_label}-${index}`}
      responsive={false}
    />
  );
}

function EvidenceLink({ result }: { result: InvestigationResult }) {
  return result.event_id ? (
    <Link href={`/events/${result.event_id}`} className="whitespace-nowrap text-xs text-signal hover:underline">
      open record
    </Link>
  ) : (
    <span className="whitespace-nowrap text-xs text-fg-subtle">projection record</span>
  );
}

function ActivityGraph({ results }: { results: InvestigationResult[] }) {
  const points = useMemo(() => {
    const counts = new Map<string, number>();
    results.forEach((item) => {
      const value = item.event.event_time ?? item.observed_at;
      if (!value) return;
      const key = new Date(value).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [results]);
  const max = Math.max(1, ...points.map(([, count]) => count));

  return (
    <DataPanel className="p-4">
      {points.length === 0 ? (
        <p className="text-xs text-fg-muted">Activity will appear after the first scan.</p>
      ) : (
        <div className="flex h-28 items-end gap-1" role="img" aria-label="Evidence activity by day">
          {points.map(([day, count]) => (
            <div key={day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-xs text-fg-subtle">{count}</span>
              <div className="w-full max-w-8 bg-signal" style={{ height: `${Math.max(8, (count / max) * 72)}px` }} title={`${day}: ${count} matches`} />
              <span className="truncate text-xs text-fg-disabled">{day.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  );
}

function StoryFact({
  icon,
  label,
  value,
  severity,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  severity?: string;
}) {
  return (
    <div className="border border-line-soft bg-canvas/30 px-3 py-3">
      <div className="flex items-center gap-2 text-fg-subtle">{icon}<span className="text-xs">{label}</span></div>
      {severity ? <div className="mt-2"><SeverityBadge severity={severity} /></div> : <div className="mt-2 font-mono text-sm text-fg">{value}</div>}
    </div>
  );
}

function buildSummary(results: InvestigationResult[]) {
  const ordered = [...results].sort((a, b) => dateValue(a) - dateValue(b));
  const modules = Array.from(new Set(results.map(moduleLabel))).map((name) => {
    const items = results.filter((item) => moduleLabel(item) === name);
    const actionCounts = new Map<string, number>();
    items.forEach((item) => {
      const action = item.event.action ?? "related activity";
      actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
    });
    const topAction = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "related activity";
    return { name, count: items.length, topAction, highestSeverity: highestSeverity(items) };
  }).sort((a, b) => b.count - a.count);
  const highest = highestSeverity(results);
  const firstSeen = ordered[0] ? (ordered[0].event.event_time ?? ordered[0].observed_at) : null;
  const lastSeen = ordered.at(-1) ? (ordered.at(-1)?.event.event_time ?? ordered.at(-1)?.observed_at) : null;
  const lead = modules[0]?.name;
  return {
    modules,
    firstSeen,
    lastSeen,
    highestSeverity: highest,
    headline: results.length === 0 ? "The case is ready for its first evidence sweep." : `${results.length} linked ${results.length === 1 ? "record" : "records"} form a trail across ${modules.length} ${modules.length === 1 ? "module" : "modules"}.`,
    narrative: results.length === 0
      ? "Run the investigation to search normalized events and the read-model tables that preserve source history. The result will be organized as a chain you can review, verify, and annotate."
      : `The strongest concentration is in ${lead}. The trail runs from ${formatShortDate(firstSeen)} to ${formatShortDate(lastSeen)} and should be read as connected evidence, not as proof that one record caused another. Start with the module carrying the most signal, then verify the surrounding records before deciding whether to contain, remediate, or close the case.`,
  };
}

function buildActions(results: InvestigationResult[], ip: string) {
  const moduleSet = new Set(results.map(moduleLabel));
  const actions: { title: string; body: string; icon: React.ReactNode }[] = [];
  if (moduleSet.has("API Gateway")) actions.push({ title: "Validate the client", body: `Review API requests tied to ${ip} and confirm whether this is an expected application, operator, or scanner.`, icon: <Network size={16} aria-hidden="true" /> });
  if (moduleSet.has("S3")) actions.push({ title: "Check storage exposure", body: "Verify whether the bucket/object access was intended, then review the bucket policy, ACL, and public-access controls.", icon: <ShieldCheck size={16} aria-hidden="true" /> });
  if (moduleSet.has("RDS")) actions.push({ title: "Confirm database identity", body: "Compare the observed source and database user with the RDS allowlist and investigate unexpected user/source pairs.", icon: <CircleAlert size={16} aria-hidden="true" /> });
  if (moduleSet.has("VPN")) actions.push({ title: "Verify the session owner", body: "Check VPN session, certificate, and user context for this IP before treating the activity as unauthorized.", icon: <CheckCircle2 size={16} aria-hidden="true" /> });
  if (moduleSet.has("AWS posture") || moduleSet.has("EC2 / Hosts") || moduleSet.has("File integrity")) actions.push({ title: "Open the affected resource", body: "Use the module evidence below to inspect the resource, its last-seen time, and the control or change that needs confirmation.", icon: <Waypoints size={16} aria-hidden="true" /> });
  if (actions.length === 0) actions.push({ title: "Expand the search window", body: "No linked evidence is available yet. Run a scan, then widen the timeline if the first pass does not explain the observable.", icon: <Clock3 size={16} aria-hidden="true" /> });
  return actions.slice(0, 4);
}

function highestSeverity(results: InvestigationResult[]) {
  const order = ["critical", "high", "medium", "low", "informational", "unscored"];
  return results.reduce((highest, result) => {
    const value = String(result.event.severity ?? "unscored");
    return order.indexOf(value) < order.indexOf(highest) ? value : highest;
  }, "unscored");
}

function moduleLabel(result: InvestigationResult) {
  const raw = String(result.event.source?.module ?? result.source_label ?? "unknown").toLowerCase();
  if (raw.includes("api")) return "API Gateway";
  if (raw.includes("rds")) return "RDS";
  if (raw.includes("vpn")) return "VPN";
  if (raw.includes("host") || raw.includes("ec2")) return "EC2 / Hosts";
  if (raw.includes("s3") || raw.includes("bucket")) return "S3";
  if (raw.includes("posture")) return "AWS posture";
  if (raw.includes("fim") || raw.includes("integrity")) return "File integrity";
  return MODULE_NAMES[raw] ?? raw;
}

function dateValue(result: InvestigationResult) {
  const value = result.event.event_time ?? result.observed_at;
  return value ? new Date(value).getTime() : 0;
}

function formatShortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function rangeDays(start: string, end: string) {
  return Math.max(1, Math.min(365, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)));
}
