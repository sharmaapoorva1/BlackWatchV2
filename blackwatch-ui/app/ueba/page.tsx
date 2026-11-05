import Link from "next/link";
import clsx from "clsx";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";
import { buildAnomalyCards, buildBaselineCards, parseUebaTab } from "@/lib/ueba-view";
import { Input } from "@/components/ui/Input";
import { ActiveFilters } from "@/components/ui/ActiveFilters";
import { Field } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import { UebaAnomalyTable } from "@/components/domain/UebaAnomalyTable";
import { toUebaAnomalyRow } from "@/lib/ueba-rows";
import { BaselineTable } from "@/components/domain/BaselineTable";
import { fetchUebaAnomalies, fetchUebaBaselines } from "@/lib/api";

type SearchParams = {
  tab?: string;
  principal_type?: string;
  principal_id?: string;
  dimension?: string;
};

export const metadata = { title: "UEBA" };

const BASELINE_LIMIT = 500;

export default async function UebaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = parseUebaTab(params.tab);

  const [anomalies, baselines] = await Promise.all([
    tab === "anomalies"
      ? fetchUebaAnomalies({ limit: 200 }).catch(() => ({
          count: 0,
          anomalies: [],
        }))
      : Promise.resolve({ count: 0, anomalies: [] }),
    tab === "baselines"
      ? fetchUebaBaselines({
          principal_type: params.principal_type,
          principal_id: params.principal_id,
          dimension: params.dimension,
          limit: BASELINE_LIMIT,
        }).catch(() => ({ count: 0, baselines: [] }))
      : Promise.resolve({ count: 0, baselines: [] }),
  ]);

  const anomalyRows = anomalies.anomalies.map(toUebaAnomalyRow);
  const cards = tab === "anomalies" ? buildAnomalyCards(anomalyRows) : buildBaselineCards(baselines.baselines, BASELINE_LIMIT);

  return (
    <>
      <PageHeader title="UEBA" subtitle="Per-principal baselines and first-seen anomalies." />

      <nav aria-label="UEBA views" className="mb-6 flex gap-1 border-b border-line-soft text-sm">
        <TabLink href="/ueba?tab=anomalies" active={tab === "anomalies"} label="Recent anomalies" />
        <TabLink href="/ueba?tab=baselines" active={tab === "baselines"} label="Baseline explorer" />
      </nav>

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="summary" title="Summary" description={tab === "anomalies" ? "What changed in recent behavior." : "What is being tracked."}>
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        {tab === "anomalies" ? (
          <Section id="anomalies" title="Recent anomalies" description="First-seen behavior per principal, newest first.">
            <DataPanel className="overflow-hidden">
              {anomalyRows.length === 0 ? (
                <EmptyState tone="ok">
                  No first-seen anomalies yet. Principals need to be past the warm-up window (default 7 days) for anomalies to fire.
                </EmptyState>
              ) : (
                <UebaAnomalyTable rows={anomalyRows} />
              )}
            </DataPanel>
          </Section>
        ) : (
          <Section id="baselines" title="Baseline explorer" description="What each principal normally does. Filter by principal or dimension.">
            <FilterBar action="/ueba" label="Filter baselines" clearHref="/ueba?tab=baselines" applyLabel="Filter">
              <input type="hidden" name="tab" value="baselines" />
              <Field label="Principal type" compact className="w-full sm:w-40">
                <Input type="text" name="principal_type" defaultValue={params.principal_type ?? ""} placeholder="user, role, service" />
              </Field>
              <Field label="Principal ID" compact className="w-full sm:w-56">
                <Input type="text" name="principal_id" defaultValue={params.principal_id ?? ""} placeholder="alice" />
              </Field>
              <Field label="Dimension" compact className="w-full sm:w-44">
                <Input type="text" name="dimension" defaultValue={params.dimension ?? ""} placeholder="source_ip" />
              </Field>
            </FilterBar>
            <ActiveFilters
              basePath="/ueba"
              params={{
                tab: "baselines",
                principal_type: params.principal_type,
                principal_id: params.principal_id,
                dimension: params.dimension,
              }}
              labels={{ principal_type: "Principal type", principal_id: "Principal ID", dimension: "Dimension" }}
              hidden={["tab"]}
            />
            <DataPanel className="overflow-hidden">
              <BaselineTable rows={baselines.baselines} />
            </DataPanel>
          </Section>
        )}
      </div>
    </>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "-mb-px border-b-2 px-3 py-2 transition-colors",
        active
          ? "border-signal text-fg"
          : "border-transparent text-fg-subtle hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}
