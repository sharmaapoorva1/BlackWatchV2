import Link from "next/link";
import clsx from "clsx";

import { fetchInvestigations } from "@/lib/api";
import {
  CASE_GROUPS,
  CASE_GROUP_LABEL,
  buildCaseCards,
  caseCounts,
  filterCases,
  parseCaseGroup,
} from "@/lib/investigations-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { InvestigationList } from "./InvestigationList";
import { InvestigationStartForm } from "./InvestigationStartForm";

type SearchParams = { ip?: string; group?: string };

export const metadata = { title: "Investigations" };

/**
 * Investigations, in the order an analyst works:
 *   1. Start      : open a case on an IP
 *   2. Case status: active / confirmed malicious / concluded (cards filter the list)
 *   3. Cases      : the list, most recently updated first
 */
export default async function InvestigationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, { investigations }] = await Promise.all([searchParams, fetchInvestigations()]);
  const group = parseCaseGroup(params.group);
  const counts = caseCounts(investigations);
  const cards = buildCaseCards(investigations);
  const shown = filterCases(investigations, group);

  return (
    <>
      <PageHeader
        title="Investigations"
        subtitle={
          investigations.length === 0
            ? "Track observables, preserve evidence, and connect related events."
            : `${investigations.length} ${investigations.length === 1 ? "case" : "cases"} · ${counts.active} active${counts.malicious > 0 ? ` · ${counts.malicious} confirmed malicious` : ""}`
        }
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section
          id="start"
          title="Start an investigation"
          description="Open a case on an IP address. You can also right-click an IP anywhere in BlackWatch and choose Add to investigation."
        >
          <DataPanel className="p-4">
            <InvestigationStartForm initialIp={params.ip} />
          </DataPanel>
        </Section>

        {investigations.length > 0 && (
          <Section id="summary" title="Case status" description="Select a card to filter the cases below.">
            <AutoGrid min="15rem">
              {cards.map((card) => (
                <StatCard key={card.id} card={card} />
              ))}
            </AutoGrid>
          </Section>
        )}

        <Section
          id="cases"
          title="Cases"
          description="Most recently updated first. Open a case for its evidence, intelligence and notes."
        >
          {investigations.length > 0 && (
            <nav aria-label="Filter cases" className="flex flex-wrap items-center gap-2">
              <FilterLink href="/investigations#cases" active={group === ""} label="All" count={investigations.length} />
              {CASE_GROUPS.map((value) => (
                <FilterLink
                  key={value}
                  href={`/investigations?group=${value}#cases`}
                  active={group === value}
                  label={CASE_GROUP_LABEL[value]}
                  count={counts[value]}
                />
              ))}
            </nav>
          )}

          {investigations.length === 0 ? (
            <DataPanel>
              <EmptyState>No investigations yet. Start one above, from an IP address you want to understand.</EmptyState>
            </DataPanel>
          ) : shown.length === 0 ? (
            <DataPanel>
              <EmptyState
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/investigations#cases">Show all cases</Link>
                  </Button>
                }
              >
                No {group ? CASE_GROUP_LABEL[group as keyof typeof CASE_GROUP_LABEL].toLowerCase() : ""} cases.
              </EmptyState>
            </DataPanel>
          ) : (
            <InvestigationList investigations={shown} />
          )}
        </Section>
      </div>
    </>
  );
}

function FilterLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:min-h-8",
        active ? "border-signal bg-signal/10 text-fg" : "border-line text-fg-muted hover:border-signal/60 hover:text-fg",
      )}
    >
      {label}
      <span className="font-mono text-xs text-fg-subtle">{count}</span>
    </Link>
  );
}
