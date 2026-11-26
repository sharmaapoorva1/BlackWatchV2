import Link from "next/link";

import { fetchAwsTimeline } from "@/lib/api";
import {
  buildAwsTimelineCards,
  parseAwsTimelineHours,
  parseAwsTimelineTab,
  timelineHref,
  toAwsActivityRow,
  windowLabel,
} from "@/lib/aws-timeline-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { StatCard } from "@/components/domain/OverviewParts";
import { AwsActivityTable } from "@/components/domain/AwsActivityTable";
import { AwsTimelineUsersTable } from "@/components/domain/AwsTimelineUsersTable";
import { ActivityTabs, WindowSwitch } from "@/components/domain/AwsTimelineNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui/Button";

export const metadata = { title: "AWS Timeline" };

type SearchParams = { tab?: string; hours?: string };

export default async function AwsTimelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tab = parseAwsTimelineTab(params.tab);
  const hours = parseAwsTimelineHours(params.hours, 24);
  // The Users tab shares the "all" response; only the table differs.
  const data = await fetchAwsTimeline(tab === "users" ? "all" : tab, hours);
  const cards = buildAwsTimelineCards(data);
  const rows = data.events.map(toAwsActivityRow);
  const span = windowLabel(hours);

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader title="AWS Timeline" subtitle="Who did what in AWS. Read-only, from CloudTrail." />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Needs attention">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section
          id="activity"
          title="Activity"
          actions={<WindowSwitch hours={hours} hrefFor={(h) => timelineHref(tab, h)} />}
        >
          <ActivityTabs
            tab={tab}
            counts={{
              critical: data.counts.critical,
              high: data.counts.high,
              all: data.counts.all,
              users: data.users.length,
            }}
            hrefFor={(t) => timelineHref(t, hours)}
          />
          <DataPanel className="overflow-hidden">
            {tab === "users" ? (
              data.users.length === 0 ? (
                <EmptyState>No users in {span}.</EmptyState>
              ) : (
                <AwsTimelineUsersTable rows={data.users} hours={hours} />
              )
            ) : rows.length === 0 ? (
              <EmptyState
                tone={tab === "all" ? "neutral" : "ok"}
                action={
                  tab === "all" ? undefined : (
                    <Link href={timelineHref("all", hours)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Show all activity
                    </Link>
                  )
                }
              >
                {tab === "all" ? `No activity in ${span}.` : `No ${tab} activity in ${span}.`}
              </EmptyState>
            ) : (
              <AwsActivityTable rows={rows} hours={hours} tableId={`aws-timeline-${tab}`} />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}
