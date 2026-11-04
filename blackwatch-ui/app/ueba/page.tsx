import Link from "next/link";
import clsx from "clsx";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { SectionLabel } from "@/components/layout/SectionLabel";
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

export default async function UebaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = params.tab === "baselines" ? "baselines" : "anomalies";

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
          limit: 500,
        }).catch(() => ({ count: 0, baselines: [] }))
      : Promise.resolve({ count: 0, baselines: [] }),
  ]);

  return (
    <>
      <PageHeader
        title="UEBA"
        subtitle="Per-principal baselines and first-seen anomalies."
      />

      <div className="mb-4 flex gap-1 border-b border-line-soft text-sm">
        <TabLink
          href="/ueba?tab=anomalies"
          active={tab === "anomalies"}
          label="Recent anomalies"
        />
        <TabLink
          href="/ueba?tab=baselines"
          active={tab === "baselines"}
          label="Baseline explorer"
        />
      </div>

      {tab === "anomalies" ? (
        <DataPanel className="overflow-hidden">
          {anomalies.anomalies.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-fg-muted">
              No first-seen anomalies yet. Principals need to be past the
              warm-up window (default 7 days) for anomalies to fire.
            </div>
          ) : (
            <UebaAnomalyTable rows={anomalies.anomalies.map(toUebaAnomalyRow)} />
          )}
        </DataPanel>
      ) : (
        <>
          <div className="mb-4 space-y-3">
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
          </div>
          <DataPanel className="overflow-hidden">
            <BaselineTable rows={baselines.baselines} />
          </DataPanel>
        </>
      )}
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
