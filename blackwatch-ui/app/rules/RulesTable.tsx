"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { NativeSelect } from "@/components/ui/NativeSelect";
import type { Rule } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { ActionForm } from "@/components/ui/ActionForm";
import { SeverityBadge, severityBorderBg } from "@/components/domain/SeverityBadge";
import { toggleRuleAction, setSeverityAction } from "./actions";

const SEVERITY_OPTIONS = [
  { value: "critical", label: "critical" },
  { value: "high", label: "high" },
  { value: "medium", label: "medium" },
  { value: "low", label: "low" },
  { value: "informational", label: "informational" },
];

const SEVERITY_FILTER_ORDER = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
] as const;

type StateFilter = "all" | "enabled" | "disabled";
type NotifyTier = "critical" | "high" | "medium" | "low" | "log" | "silent";

const NOTIFY_TIER_ORDER: NotifyTier[] = [
  "critical",
  "high",
  "medium",
  "low",
  "log",
  "silent",
];

const NOTIFY_TIER_LABEL: Record<NotifyTier, string> = {
  critical: "notify:critical",
  high: "notify:high",
  medium: "notify:medium",
  low: "notify:low",
  log: "notify:log",
  silent: "silent",
};

const NOTIFY_TIER_DOT: Record<NotifyTier, string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  log: "bg-fg-subtle",
  silent: "bg-fg-disabled",
};

/** Rule IDs use `<source>-...`; anything before the first hyphen is the
 *  source group (`api`, `vpn`, `rds`, `aws`, `iam`, ...). If there's no
 *  hyphen we bucket it as "other". */
function sourceOf(id: string): string {
  const i = id.indexOf("-");
  return i > 0 ? id.slice(0, i) : "other";
}

/** Extract notify tier from tags. Rules without any `notify:*` tag are
 *  bucketed as "silent" — the engine loads them but they don't page anyone,
 *  which is useful for low-value log-only rules. */
function notifyTierOf(tags: string[] | undefined): NotifyTier {
  if (!tags) return "silent";
  for (const t of tags) {
    if (!t.startsWith("notify:")) continue;
    const tier = t.slice("notify:".length).toLowerCase();
    if (tier === "critical" || tier === "high" || tier === "medium" || tier === "low" || tier === "log") {
      return tier;
    }
  }
  return "silent";
}

function toggleInSet(prev: Set<string>, value: string): Set<string> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// =========================================================================
// Component
// =========================================================================

export function RulesTable({ rules }: { rules: Rule[] }) {
  const [q, setQ] = useState("");
  const [severities, setSeverities] = useState<Set<string>>(new Set());
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [notifyTiers, setNotifyTiers] = useState<Set<NotifyTier>>(new Set());
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [showFacets, setShowFacets] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
        const tag = document.activeElement?.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQ("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Derive facets and counts once per rules[]. Counts are shown on chips so
  // the operator can see "how many rules will disappear if I click this".
  const facets = useMemo(() => {
    const bySource = new Map<string, number>();
    const bySeverity = new Map<string, number>();
    const byNotify = new Map<NotifyTier, number>();
    let enabledCount = 0;
    for (const r of rules) {
      const src = sourceOf(r.id);
      bySource.set(src, (bySource.get(src) ?? 0) + 1);
      const sev = typeof r.severity === "string" ? r.severity : "unscored";
      bySeverity.set(sev, (bySeverity.get(sev) ?? 0) + 1);
      const tier = notifyTierOf(r.tags);
      byNotify.set(tier, (byNotify.get(tier) ?? 0) + 1);
      if (r.enabled) enabledCount++;
    }
    return {
      sources: Array.from(bySource.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      severities: SEVERITY_FILTER_ORDER.map((k) => [k, bySeverity.get(k) ?? 0] as const),
      notifyTiers: NOTIFY_TIER_ORDER.map((k) => [k, byNotify.get(k) ?? 0] as const),
      enabledCount,
      disabledCount: rules.length - enabledCount,
    };
  }, [rules]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rules.filter((r) => {
      if (needle) {
        const hay = [
          r.id,
          r.title,
          r.description ?? "",
          (r.matched_actions ?? []).join(" "),
          (r.tags ?? []).join(" "),
          typeof r.severity === "string" ? r.severity : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (severities.size > 0) {
        const sev = typeof r.severity === "string" ? r.severity : "unscored";
        if (!severities.has(sev)) return false;
      }
      if (stateFilter === "enabled" && !r.enabled) return false;
      if (stateFilter === "disabled" && r.enabled) return false;
      if (notifyTiers.size > 0) {
        if (!notifyTiers.has(notifyTierOf(r.tags))) return false;
      }
      if (sources.size > 0) {
        if (!sources.has(sourceOf(r.id))) return false;
      }
      return true;
    });
  }, [q, severities, stateFilter, notifyTiers, sources, rules]);

  const anyFilterActive =
    q.length > 0 ||
    severities.size > 0 ||
    stateFilter !== "all" ||
    notifyTiers.size > 0 ||
    sources.size > 0;
  const activeFacetCount =
    severities.size + notifyTiers.size + sources.size + (stateFilter === "all" ? 0 : 1);

  function clearAll() {
    setQ("");
    setSeverities(new Set());
    setStateFilter("all");
    setNotifyTiers(new Set());
    setSources(new Set());
  }

  return (
    <div className="flex flex-col">
      {/* ------- Filter toolbar ------------------------------------------- */}
      <section aria-label="Rule filters" className="flex flex-col gap-2.5 border-b border-line-soft bg-surface-1 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-2 text-xs font-medium text-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
            Filters
          </div>
          <SearchIcon />
          <Input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by id, title, event action, tag…"
            aria-label="Filter rules"
            className="min-w-0 flex-1 bg-transparent text-xs text-fg placeholder:text-fg-disabled focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
          />
          <kbd className="hidden select-none rounded border border-line-soft bg-canvas px-1.5 py-0.5 font-mono text-xs text-fg-subtle sm:inline">
            /
          </kbd>
          <span
            className={clsx(
              "font-mono text-xs",
              anyFilterActive ? "text-signal" : "text-fg-subtle",
            )}
          >
            {filtered.length}
            {anyFilterActive && (
              <>
                <span className="text-fg-disabled"> / </span>
                <span className="text-fg-subtle">{rules.length}</span>
              </>
            )}
          </span>
          <Button
            size="sm" variant="ghost"
            type="button"
            onClick={() => setShowFacets((open) => !open)}
            aria-expanded={showFacets}
            className="rounded border border-line-soft px-2 py-1 text-xs text-fg-subtle transition-colors hover:border-signal hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
          >
            {showFacets ? "Hide filters" : "More filters"}
            {activeFacetCount > 0 ? ` · ${activeFacetCount}` : ""}
          </Button>
          {anyFilterActive && (
            <Button size="sm" variant="ghost"
              type="button"
              onClick={clearAll}
              className="rounded border border-line-soft px-1.5 py-0.5 text-xs text-fg-subtle transition-colors hover:border-signal hover:text-signal"
              aria-label="Clear all filters"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Facet rows — one label + inline chips per facet */}
        {showFacets && <div className="grid grid-cols-1 gap-2 border-t border-line-soft pt-2 text-xs xl:grid-cols-2">
          <FacetRow label="severity">
            {facets.severities.map(([sev, count]) => (
              <SeverityChip
                key={sev}
                sev={sev}
                count={count}
                active={severities.has(sev)}
                onToggle={() => setSeverities((p) => toggleInSet(p, sev))}
              />
            ))}
          </FacetRow>

          <FacetRow label="state">
            <StateChip
              label="enabled"
              count={facets.enabledCount}
              active={stateFilter === "enabled"}
              activeDot="bg-sev-resolved"
              onClick={() =>
                setStateFilter((s) => (s === "enabled" ? "all" : "enabled"))
              }
            />
            <StateChip
              label="disabled"
              count={facets.disabledCount}
              active={stateFilter === "disabled"}
              activeDot="bg-fg-subtle"
              onClick={() =>
                setStateFilter((s) => (s === "disabled" ? "all" : "disabled"))
              }
            />
          </FacetRow>

          <FacetRow label="notify">
            {facets.notifyTiers.map(([tier, count]) => (
              <NotifyChip
                key={tier}
                tier={tier}
                count={count}
                active={notifyTiers.has(tier)}
                onToggle={() =>
                  setNotifyTiers((p) => {
                    const next = new Set(p);
                    if (next.has(tier)) next.delete(tier);
                    else next.add(tier);
                    return next;
                  })
                }
              />
            ))}
          </FacetRow>

          <FacetRow label="source">
            {facets.sources.map(([src, count]) => (
              <SourceChip
                key={src}
                src={src}
                count={count}
                active={sources.has(src)}
                onToggle={() => setSources((p) => toggleInSet(p, src))}
              />
            ))}
          </FacetRow>
        </div>}
      </section>

      {/* ------- Table --------------------------------------------------- */}
      <RuleListTable rules={filtered} hasFilter={anyFilterActive} onClear={clearAll} />
    </div>
  );
}

// =========================================================================
// Table
// =========================================================================

const SEVERITY_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

function RuleListTable({
  rules,
  hasFilter,
  onClear,
}: {
  rules: Rule[];
  hasFilter: boolean;
  onClear: () => void;
}) {
  const columns = useMemo<ColumnDef<Rule, unknown>[]>(
    () => [
      {
        id: "rule",
        header: "Rule",
        accessorFn: (r) => r.title,
        enableHiding: false,
        meta: { label: "Rule", className: "relative" },
        cell: ({ row }) => {
          const r = row.original;
          const sev = typeof r.severity === "string" ? r.severity : null;
          return (
            <>
              {/* Left severity strip: scan severity down the whole column. */}
              <span
                aria-hidden
                className={clsx("pointer-events-none absolute left-0 top-0 h-full w-[3px]", severityBorderBg(sev))}
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <SourceBadge src={sourceOf(r.id)} />
                  {r.rule_action === "suppress" && (
                    <span className="rounded border border-line-soft px-1 py-px text-xs text-fg-subtle">suppress</span>
                  )}
                </div>
                <div className="pr-2 text-[13px] font-medium leading-snug text-fg">{r.title}</div>
                <div className="font-mono text-xs text-fg-subtle">{r.id}</div>
              </div>
            </>
          );
        },
      },
      {
        id: "event_actions",
        header: "Event actions",
        enableSorting: false,
        meta: { label: "Event actions" },
        cell: ({ row }) =>
          row.original.matched_actions && row.original.matched_actions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.original.matched_actions.map((a) => (
                <code key={a} className="rounded-sm border border-line-soft bg-canvas px-1.5 py-0.5 font-mono text-xs text-fg">
                  {a}
                </code>
              ))}
            </div>
          ) : (
            <span className="text-xs text-fg-disabled">matches on non-action fields</span>
          ),
      },
      {
        id: "notify",
        header: "Tags & notify",
        accessorFn: (r) => NOTIFY_TIER_ORDER.indexOf(notifyTierOf(r.tags)),
        meta: { label: "Tags & notify" },
        cell: ({ row }) => {
          const otherTags = (row.original.tags ?? []).filter((t) => !t.startsWith("notify:"));
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <NotifyPill tier={notifyTierOf(row.original.tags)} />
              {otherTags.map((t) => (
                <span key={t} className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-subtle">
                  {t}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (r) => SEVERITY_RANK[typeof r.severity === "string" ? r.severity : ""] ?? 0,
        sortDescFirst: true,
        meta: { label: "Severity" },
        cell: ({ row }) => (
          <SeverityPicker
            ruleId={row.original.id}
            current={typeof row.original.severity === "string" ? row.original.severity : null}
          />
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Actions", isActions: true },
        cell: ({ row }) => (
          <ActionForm
            action={toggleRuleAction}
            fields={{ rule_id: row.original.id, enabled: row.original.enabled ? "off" : "on" }}
            variant={row.original.enabled ? "ghost" : "secondary"}
          >
            {row.original.enabled ? "Disable" : "Enable"}
          </ActionForm>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="rules-list-v2"
      ariaLabel="Rules"
      columns={columns}
      data={rules}
      getRowId={(r) => r.id}
      rowClassName={(row) => (row.original.enabled ? undefined : "opacity-50")}
      emptyMessage={<EmptyState onClear={onClear} hasFilter={hasFilter} />}
    />
  );
}

// =========================================================================
// Facet chips
// =========================================================================

function FacetRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 text-fg-subtle">
        {label}
      </span>
      {children}
    </div>
  );
}

function baseChipClass(active: boolean) {
  return clsx(
    "inline-flex select-none items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs transition-colors",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal",
    active
      ? "border-signal bg-surface-2 text-fg"
      : "border-line-soft text-fg-subtle hover:border-fg-subtle hover:text-fg",
  );
}

function SeverityChip({
  sev,
  count,
  active,
  onToggle,
}: {
  sev: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  const dot = severityBorderBg(sev);
  return (
    <Button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={baseChipClass(active)}
      disabled={count === 0}
      style={count === 0 ? { opacity: 0.3, cursor: "not-allowed" } : undefined}
    >
      <span
        aria-hidden
        className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dot)}
      />
      <span>{sev}</span>
      <span className="font-mono text-fg-disabled">{count}</span>
    </Button>
  );
}

function StateChip({
  label,
  count,
  active,
  activeDot,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  activeDot: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={baseChipClass(active)}
    >
      <span
        aria-hidden
        className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", activeDot)}
      />
      <span>{label}</span>
      <span className="font-mono text-fg-disabled">{count}</span>
    </Button>
  );
}

function NotifyChip({
  tier,
  count,
  active,
  onToggle,
}: {
  tier: NotifyTier;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={baseChipClass(active)}
      disabled={count === 0}
      style={count === 0 ? { opacity: 0.3, cursor: "not-allowed" } : undefined}
    >
      <span
        aria-hidden
        className={clsx(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          NOTIFY_TIER_DOT[tier],
        )}
      />
      <span>{tier}</span>
      <span className="font-mono text-fg-disabled">{count}</span>
    </Button>
  );
}

function SourceChip({
  src,
  count,
  active,
  onToggle,
}: {
  src: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={baseChipClass(active)}
    >
      <span className="font-mono">{src}</span>
      <span className="font-mono text-fg-disabled">{count}</span>
    </Button>
  );
}

// =========================================================================
// Small presentational atoms
// =========================================================================

function SourceBadge({ src }: { src: string }) {
  return (
    <span className="rounded-sm border border-line-soft px-1 py-px font-mono text-xs text-fg-subtle">
      {src}
    </span>
  );
}

function NotifyPill({ tier }: { tier: NotifyTier }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-xs",
        tier === "silent"
          ? "border-line-soft text-fg-disabled"
          : "border-line-soft text-fg-muted",
      )}
      title={NOTIFY_TIER_LABEL[tier]}
    >
      <span
        aria-hidden
        className={clsx("h-1.5 w-1.5 rounded-full", NOTIFY_TIER_DOT[tier])}
      />
      {NOTIFY_TIER_LABEL[tier]}
    </span>
  );
}

function EmptyState({
  onClear,
  hasFilter,
}: {
  onClear: () => void;
  hasFilter: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-fg-muted">
      <div className="font-mono text-xs text-fg-subtle">
        no rules match
      </div>
      <p className="text-sm">
        {hasFilter
          ? "Try widening a facet or clearing the search box."
          : "You don't have any rules loaded — check rules/ on disk."}
      </p>
      {hasFilter && (
        <Button size="sm" variant="ghost"
          type="button"
          onClick={onClear}
          className="rounded border border-line-soft px-2 py-1 text-xs text-fg-subtle transition-colors hover:border-signal hover:text-signal"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="shrink-0 text-fg-subtle"
    >
      <circle cx="5" cy="5" r="3.25" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M7.5 7.5L10 10"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// =========================================================================
// Severity picker (unchanged behaviour, restyled)
// =========================================================================

function SeverityPicker({
  ruleId,
  current,
}: {
  ruleId: string;
  current: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={setSeverityAction}
      className="inline-flex items-center gap-1.5"
    >
      <input type="hidden" name="rule_id" value={ruleId} />
      <span className="pointer-events-none">
        {current ? <SeverityBadge severity={current} /> : null}
      </span>
      <NativeSelect name="severity" defaultValue={current ?? "default"} aria-label={`Set severity for ${ruleId}`} className="min-h-8 w-[108px] text-xs" onChange={() => {
           setTimeout(() => formRef.current?.requestSubmit(), 0);
          }}>
        <option value="default">— clear override —</option>
        {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </NativeSelect>
    </form>
  );
}
