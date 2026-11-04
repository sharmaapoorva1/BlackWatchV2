import Link from "next/link";

import { fetchNotificationLog } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Input } from "@/components/ui/Input";
import { ActiveFilters } from "@/components/ui/ActiveFilters";
import { Field } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { BackLink } from "@/components/ui/BackLink";
import { NotificationLogTable } from "@/components/domain/NotificationLogTable";
import { AutoRefresh } from "@/components/layout/AutoRefresh";

const STATUSES = ["sent", "failed", "rate_limited", "throttled", "digested", "acked"];

type SearchParams = {
  status?: string;
  channel?: string;
  rule?: string;
};

export default async function NotificationLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { count, entries } = await fetchNotificationLog({
    status: params.status,
    channel: params.channel,
    rule: params.rule,
    limit: 300,
  });

  return (
    <>
      <AutoRefresh intervalMs={5000} />

      <BackLink href="/notifications" label="back to notifications" />

      <PageHeader
        title="Notification log"
        subtitle={`${count} entries`}
      />

      <FilterBar action="/notifications/log" label="Filter notification log" clearHref="/notifications/log" className="mb-4">
        <Field label="Status" compact className="w-full sm:w-44">
          <NativeSelect name="status" defaultValue={params.status ?? ""}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Channel" compact className="w-full sm:w-48">
          <Input name="channel" defaultValue={params.channel ?? ""} placeholder="channel name" />
        </Field>
        <Field label="Rule" compact className="w-full sm:w-48">
          <Input name="rule" defaultValue={params.rule ?? ""} placeholder="rule name" />
        </Field>
      </FilterBar>
      <div className="mb-4">
        <ActiveFilters
          basePath="/notifications/log"
          params={{ status: params.status, channel: params.channel, rule: params.rule }}
          labels={{ status: "Status", channel: "Channel", rule: "Rule" }}
        />
      </div>

      <DataPanel className="overflow-hidden">
        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-fg-muted">
            No log entries match the filter.
          </div>
        ) : (
          <NotificationLogTable entries={entries} tableId="notifications-log" ariaLabel="Notification log" />
        )}
      </DataPanel>
    </>
  );
}
