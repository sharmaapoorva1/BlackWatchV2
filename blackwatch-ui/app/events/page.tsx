import { Suspense } from "react";
import Link from "next/link";

import { fetchEventFilterOptions, fetchEvents } from "@/lib/api";
import { EVENT_FEED_LIMIT, hasFilters, resultsSummary, severityMix, type EventFilterParams } from "@/lib/events-view";
import { toEventTableRow } from "@/lib/event-summary";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Section } from "@/components/layout/Section";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActiveFilters } from "@/components/ui/ActiveFilters";
import { Field } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import { SavedFilters } from "@/components/domain/SavedFilters";
import { EventsDataTable } from "@/components/domain/EventsDataTable";
import { SeverityChips, SeverityMixBar } from "@/components/domain/EventsFeedParts";

export const metadata = { title: "Events" };

type SearchParams = EventFilterParams;

/**
 * Events: h1 page, one h2 "Event feed". Inside it, top to bottom:
 *   1. filters  : severity chips (one click), search + selects, active-filter
 *                 chips, saved filters
 *   2. the shape: how many results and their severity mix
 *   3. the feed : newest first; a click opens the quick-look panel
 */
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
      limit: EVENT_FEED_LIMIT,
    }),
    fetchEventFilterOptions(),
  ]);

  const filtered = hasFilters(params);
  const mix = severityMix(events);

  return (
    <>
      <AutoRefresh intervalMs={5000} />
      <PageHeader title="Events" subtitle={resultsSummary(count, filtered)} />

      <Section
        id="feed"
        title="Event feed"
        description="Select an event to inspect it without leaving the list. The feed refreshes every few seconds."
      >
        <div className="space-y-4 rounded-md border border-line bg-surface-1 p-4">
          <SeverityChips params={params} mix={mix} />
          <EventFilters params={params} options={options} />
          {filtered && (
            <ActiveFilters
              basePath="/events"
              params={params}
              labels={{ q: "Search", severity: "Severity", category: "Category", module: "Module", action: "Action" }}
            />
          )}
          <Suspense fallback={null}>
            <SavedFilters storageKey="bw.events.savedFilters" />
          </Suspense>
        </div>

        {events.length > 0 && <SeverityMixBar mix={mix} />}

        <DataPanel className="overflow-hidden">
          {events.length === 0 ? (
            <EmptyState
              size="lg"
              action={
                filtered ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/events">Clear filters</Link>
                  </Button>
                ) : undefined
              }
            >
              {filtered
                ? "No events match these filters. Try fewer filters or a broader search."
                : "No events yet. Has an agent or connector reported?"}
            </EmptyState>
          ) : (
            <EventsDataTable events={events.map(toEventTableRow)} />
          )}
        </DataPanel>
      </Section>
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
      {/* Severity is chosen with the chips above; keep it when the form is applied. */}
      {params.severity && <input type="hidden" name="severity" value={params.severity} />}
      <Field label="Search" compact className="w-full sm:w-72">
        <Input
          name="q"
          autoComplete="off"
          defaultValue={params.q ?? ""}
          placeholder="Actor, IP, target, action…"
        />
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
