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
      <FilterBar params={params} options={options} />

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

function FilterBar({
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
    <form
      action="/events"
      method="GET"
    className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(18rem,2fr)_repeat(4,minmax(11rem,1fr))_minmax(8rem,auto)_minmax(6rem,auto)]"
  >
      <Input
        name="q"
        aria-label="Search events"
        autoComplete="off"
        defaultValue={params.q ?? ""}
        placeholder="Search actor, IP, target, action…"
        className="w-full"
      />
      <NativeSelect name="severity" aria-label="Severity" defaultValue={params.severity ?? ""} className="w-full">
        <option value="">All severities</option>
        {(options.severities.length ? options.severities : SEVERITY_VALUES).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect name="category" aria-label="Category" defaultValue={params.category ?? ""} className="w-full">
        <option value="">All categories</option>
        {options.categories.map((value) => <option key={value} value={value}>{value}</option>)}
      </NativeSelect>
      <NativeSelect name="module" aria-label="Source module" defaultValue={params.module ?? ""} className="w-full">
        <option value="">All source modules</option>
        {options.modules.map((value) => <option key={value} value={value}>{value}</option>)}
      </NativeSelect>
      <NativeSelect name="action" aria-label="Action" defaultValue={params.action ?? ""} className="w-full">
        <option value="">All actions</option>
        {options.actions.map((value) => <option key={value} value={value}>{value}</option>)}
      </NativeSelect>
      <Button type="submit" variant="primary" size="sm" className="w-full min-w-32 justify-self-stretch">
        Apply filters
      </Button>
      <Button asChild variant="secondary" size="sm" className="w-full min-w-24 justify-self-stretch">
        <Link href="/events">Clear</Link>
      </Button>
    </form>
  );
}
