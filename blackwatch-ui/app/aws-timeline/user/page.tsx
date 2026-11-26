import { fetchAwsTimelineUser } from "@/lib/api";
import { buildUserCards, parseAwsTimelineHours, userTimelineHref, windowLabel } from "@/lib/aws-timeline-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { StickyHeader } from "@/components/layout/StickyHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { StatCard } from "@/components/domain/OverviewParts";
import { IpCell } from "@/components/domain/IpCell";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { WindowSwitch } from "@/components/domain/AwsTimelineNav";
import { DownloadCsvButton, UserTimeline } from "@/components/domain/AwsUserTimeline";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "AWS Timeline user" };

type SearchParams = { principal?: string; hours?: string };

const CRUMBS = [{ label: "AWS Timeline", href: "/aws-timeline?tab=users" }];

export default async function AwsTimelineUserPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const principal = (params.principal ?? "").trim();
  const hours = parseAwsTimelineHours(params.hours, 168);

  if (!principal) {
    return (
      <>
        <PageHeader title="AWS Timeline" breadcrumbs={[...CRUMBS, { label: "User" }]} />
        <EmptyState>Pick a user on the Users tab.</EmptyState>
      </>
    );
  }

  const data = await fetchAwsTimelineUser(principal, hours);
  const s = data.summary;
  const span = windowLabel(hours);

  return (
    <>
      <StickyHeader>
        <Breadcrumbs items={[...CRUMBS, { label: "User" }]} />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="min-w-0 break-all font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">{principal}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <WindowSwitch hours={hours} hrefFor={(h) => userTimelineHref(principal, h)} />
            <DownloadCsvButton events={data.events} principal={principal} />
          </div>
        </div>
        {s.last_seen && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-subtle">
            Last active <TimestampCell value={s.last_seen} />
            {s.first_seen && (
              <>
                · first seen in {span} <TimestampCell value={s.first_seen} />
              </>
            )}
          </p>
        )}
      </StickyHeader>

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Summary">
          <AutoGrid min="15rem">
            {buildUserCards(data).map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="timeline" title="Timeline">
          {data.events.length === 0 ? (
            <DataPanel>
              <EmptyState>No activity in {span}.</EmptyState>
            </DataPanel>
          ) : (
            <>
              <UserTimeline events={data.events} />
              {data.truncated && <p className="text-xs text-fg-subtle">Showing the newest 1,000 events.</p>}
            </>
          )}
        </Section>

        {data.events.length > 0 && (
          <Section id="breakdown" title="Breakdown">
            <Subsection id="source-ips" title="Source IPs" count={s.source_ips.length} defaultOpen={false}>
              <Counts rows={s.source_ips.map(([ip, count]) => ({ key: ip, count, node: <IpCell value={ip} className="text-xs" /> }))} />
            </Subsection>
            <Subsection id="actions" title="Actions" count={s.top_actions.length} defaultOpen={false}>
              <Counts
                rows={s.top_actions.map(([action, count]) => ({
                  key: action,
                  count,
                  node: <span className="break-all font-mono text-xs text-fg">{action}</span>,
                }))}
              />
            </Subsection>
          </Section>
        )}
      </div>
    </>
  );
}

function Counts({ rows }: { rows: { key: string; count: number; node: React.ReactNode }[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line-soft rounded-md border border-line-soft bg-surface-1">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center justify-between gap-4 px-3 py-2">
          {row.node}
          <span className="font-mono text-xs text-fg-muted">{row.count.toLocaleString("en-US")}</span>
        </li>
      ))}
    </ul>
  );
}
