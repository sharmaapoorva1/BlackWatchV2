import Link from "next/link";
import clsx from "clsx";

import { fetchAwsTimelineUser } from "@/lib/api";
import { AWS_TIMELINE_WINDOWS, parseAwsTimelineHours } from "@/lib/aws-timeline-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Section } from "@/components/layout/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { DownloadCsvButton, UserTimeline } from "@/components/domain/AwsUserTimeline";
import { TimestampCell } from "@/components/domain/TimestampCell";

export const metadata = { title: "AWS Timeline user" };

type SearchParams = { principal?: string; hours?: string };

export default async function AwsTimelineUserPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const principal = (params.principal ?? "").trim();
  const hours = parseAwsTimelineHours(params.hours, 168);
  const crumbs = [{ label: "AWS Timeline", href: "/aws-timeline?tab=users" }, { label: "User" }];

  if (!principal) {
    return (
      <>
        <PageHeader title="AWS Timeline" breadcrumbs={crumbs} />
        <EmptyState>Pick a user from the Users tab.</EmptyState>
      </>
    );
  }

  const data = await fetchAwsTimelineUser(principal, hours);
  const s = data.summary;
  const sevText = Object.entries(s.severities)
    .map(([sev, count]) => `${count} ${sev === "none" ? "unscored" : sev}`)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={principal}
        subtitle="Everything BlackWatch collected from CloudTrail for this user, newest first."
        breadcrumbs={crumbs}
        actions={<DownloadCsvButton events={data.events} principal={principal} />}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="summary" title="Summary" description="Window, counts and where they came from.">
          <nav aria-label="Time window" className="mb-3 flex gap-1 text-xs">
            {AWS_TIMELINE_WINDOWS.map((w) => (
              <Link
                key={w.hours}
                href={`/aws-timeline/user?principal=${encodeURIComponent(principal)}&hours=${w.hours}`}
                className={clsx(
                  "rounded-md border px-2 py-1 transition-colors",
                  hours === w.hours ? "border-signal text-fg" : "border-line-soft text-fg-subtle hover:text-fg",
                )}
              >
                {w.label}
              </Link>
            ))}
          </nav>
          <DataPanel className="p-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Item
                label="Events"
                value={`${s.events.toLocaleString("en-US")}${data.truncated ? " (showing the newest 1,000)" : ""}`}
              />
              <Item label="Failed" value={String(s.failed)} />
              <Item label="Severity" value={sevText || "—"} />
              <Item label="First seen" value={s.first_seen ? <TimestampCell value={s.first_seen} /> : "—"} />
              <Item label="Last seen" value={s.last_seen ? <TimestampCell value={s.last_seen} /> : "—"} />
              <Item
                label="Source IPs"
                value={s.source_ips.length ? s.source_ips.map(([ip, n]) => `${ip} (${n})`).join(", ") : "—"}
              />
              <Item
                label="Top actions"
                value={s.top_actions.length ? s.top_actions.map(([a, n]) => `${a} (${n})`).join(", ") : "—"}
              />
            </dl>
          </DataPanel>
        </Section>

        <Section id="timeline" title="Timeline" description="Event times use your browser clock; days are grouped in UTC.">
          <DataPanel className="p-4">
            {data.events.length === 0 ? (
              <EmptyState>No activity for this user in the selected window.</EmptyState>
            ) : (
              <UserTimeline events={data.events} />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="break-words text-fg">{value}</dd>
    </div>
  );
}
