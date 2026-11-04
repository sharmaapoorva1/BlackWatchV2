import Link from "next/link";

import { fetchNotificationLog } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
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

      <form
        action="/notifications/log"
        method="GET"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <NativeSelect name="status" defaultValue={params.status ?? ""}>
          <option value="">any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
        <Input
          name="channel"
          defaultValue={params.channel ?? ""}
          placeholder="channel name"
          className="w-44"
        />
        <Input
          name="rule"
          defaultValue={params.rule ?? ""}
          placeholder="rule name"
          className="w-44"
        />
        <Button type="submit" variant="primary" size="sm">
          Filter
        </Button>
        <Link href="/notifications/log" className="ml-1 text-xs text-fg-muted hover:text-fg">
          reset
        </Link>
      </form>

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
