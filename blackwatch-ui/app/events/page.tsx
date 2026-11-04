import { Suspense } from "react";
import Link from "next/link";

import { fetchEventFilterOptions, fetchEvents } from "@/lib/api";
import { SEVERITY_VALUES } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { SavedFilters } from "@/components/domain/SavedFilters";
import { ActiveFilters } from "@/components/ui/ActiveFilters";
import { Field } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import { EventsDataTable } from "@/components/domain/EventsDataTable";
import { toEventTableRow } from "@/lib/event-summary";

type SearchParams = {
  q?: string;
  severity?: string;
  category?: string;
  module?: string;
  action?: string;
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [{ count, events }, options] = await Promise.all([
    fetchEvents({
      q: params.q,
      severity: params.severity,
      category: params.category,
      module: params.module,
      action: params.action,
    }),
    fetchEventFilterOptions(),
  ]);

  return (
    <>
      <AutoRefresh intervalMs={5000} />
      <PageHeader
        title="Events"
        subtitle={`Showing ${count} event${count === 1 ? "" : "s"}.`}
      />

      <Suspense fallback={null}>
        <SavedFilters storageKey="bw.events.savedFilters" />
      </Suspense>
      <EventFilters params={params} options={options} />
      <div className="mt-3">
        <ActiveFilters
          basePath="/events"
          params={params}
          labels={{ q: "Search", severity: "Severity", category: "Category", module: "Module", action: "Action" }}
        />
      </div>

      <DataPanel className="mt-4 overflow-hidden">
        {events.length === 0 ? (
          <EmptyState size="lg">No events match the current filters.</EmptyState>
        ) : (
          <EventsDataTable events={events.map(toEventTableRow)} />
        )}
      </DataPanel>
    </>
  );
}

function EventFilters({
  params,
  options,
}: {
  params: SearchParams;
  options: {
    categories: string[];
    modules: string[];
    actions: string[];
    severities: string[];
  };
}) {
  return (
    <FilterBar action="/events" label="Filter events" clearHref="/events">
      <Field label="Search" compact className="w-full sm:w-72">
        <Input
          name="q"
          autoComplete="off"
          defaultValue={params.q ?? ""}
          placeholder="Actor, IP, target, action…"
        />
      </Field>
      <Field label="Severity" compact className="w-full sm:w-40">
        <NativeSelect name="severity" defaultValue={params.severity ?? ""}>
          <option value="">All severities</option>
          {(options.severities.length ? options.severities : SEVERITY_VALUES).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Category" compact className="w-full sm:w-40">
        <NativeSelect name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {options.categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Source module" compact className="w-full sm:w-48">
        <NativeSelect name="module" defaultValue={params.module ?? ""}>
          <option value="">All source modules</option>
          {options.modules.map((value) => <option key={value} value={value}>{value}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Action" compact className="w-full sm:w-56">
        <NativeSelect name="action" defaultValue={params.action ?? ""}>
          <option value="">All actions</option>
          {options.actions.map((value) => <option key={value} value={value}>{value}</option>)}
        </NativeSelect>
      </Field>
    </FilterBar>
  );
}
