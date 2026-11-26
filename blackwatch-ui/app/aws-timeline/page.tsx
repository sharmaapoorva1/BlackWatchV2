import Link from "next/link";
import clsx from "clsx";

import { fetchAwsTimeline } from "@/lib/api";
import {
  AWS_TIMELINE_TABS,
  AWS_TIMELINE_WINDOWS,
  buildAwsTimelineCards,
  parseAwsTimelineHours,
  parseAwsTimelineTab,
  windowLabel,
} from "@/lib/aws-timeline-view";
import { toIamRow } from "@/lib/iam-rows";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { StatCard } from "@/components/domain/OverviewParts";
import { IamEventsTable } from "@/components/domain/IamTables";
import { AwsTimelineUsersTable } from "@/components/domain/AwsTimelineUsersTable";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "AWS Timeline" };

type SearchParams = { tab?: string; hours?: string };

export default async function AwsTimelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tab = parseAwsTimelineTab(params.tab);
  const hours = parseAwsTimelineHours(params.hours, 24);
  // The users tab shares the "all" response; only the event list differs.
  const data = await fetchAwsTimeline(tab === "users" ? "all" : tab, hours);
  const cards = buildAwsTimelineCards(data).map((card) => ({
    ...card,
    href: `/aws-timeline${card.href}&hours=${hours}`,
  }));
  const rows = data.events.map((event) => toIamRow(event));
  const tabHref = (id: string) => `/aws-timeline?tab=${id}&hours=${hours}`;
  const tabCount: Record<string, number> = {
    critical: data.counts.critical,
    high: data.counts.high,
    all: data.counts.all,
    users: data.users.length,
  };

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="AWS Timeline"
        subtitle="What users and roles did in AWS, from CloudTrail. Read-only. Only the API calls BlackWatch collects appear here."
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="summary" title="Summary" description={`Last ${windowLabel(hours).toLowerCase()}.`}>
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft">
            <nav aria-label="AWS timeline views" className="flex gap-1 text-sm">
              {AWS_TIMELINE_TABS.map((t) => (
                <Link
                  key={t.id}
                  href={tabHref(t.id)}
                  className={clsx(
                    "-mb-px border-b-2 px-3 py-2 transition-colors",
                    tab === t.id ? "border-signal text-fg" : "border-transparent text-fg-subtle hover:text-fg",
                  )}
                >
                  {t.label}
                  <span className="ml-1.5 font-mono text-xs text-fg-subtle">{tabCount[t.id]}</span>
                </Link>
              ))}
            </nav>
            <nav aria-label="Time window" className="flex gap-1 pb-1 text-xs">
              {AWS_TIMELINE_WINDOWS.map((w) => (
                <Link
                  key={w.hours}
                  href={`/aws-timeline?tab=${tab}&hours=${w.hours}`}
                  className={clsx(
                    "rounded-md border px-2 py-1 transition-colors",
                    hours === w.hours ? "border-signal text-fg" : "border-line-soft text-fg-subtle hover:text-fg",
                  )}
                >
                  {w.label}
                </Link>
              ))}
            </nav>
          </div>

          {tab === "users" ? (
            <Section id="users" title="Users and roles" description="Select a user to see everything they did, in time order.">
              <DataPanel className="overflow-hidden">
                {data.users.length === 0 ? (
                  <EmptyState tone="ok">No CloudTrail users seen in this window.</EmptyState>
                ) : (
                  <AwsTimelineUsersTable rows={data.users} hours={hours} />
                )}
              </DataPanel>
            </Section>
          ) : (
            <Section
              id="events"
              title={tab === "critical" ? "Critical activity" : tab === "high" ? "High activity" : "All activity"}
              description={
                tab === "all"
                  ? "Latest 200 events. Events no rule has scored show as Unscored."
                  : "Latest 200 events a rule marked at this severity."
              }
            >
              <DataPanel className="overflow-hidden">
                {rows.length === 0 ? (
                  <EmptyState tone={tab === "all" ? "neutral" : "ok"}>
                    {tab === "all" ? "No CloudTrail events in this window." : `No ${tab} AWS activity in this window.`}
                  </EmptyState>
                ) : (
                  <IamEventsTable
                    rows={rows}
                    tableId={`aws-timeline-${tab}`}
                    ariaLabel={`AWS ${tab} activity`}
                    showOutcome
                    showSourceIp
                    showTarget
                  />
                )}
              </DataPanel>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
