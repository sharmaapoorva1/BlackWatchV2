import Link from "next/link";
import { Plus } from "lucide-react";

import { fetchConnectors } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Button } from "@/components/ui/Button";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { RetryAllButton } from "@/components/domain/connectors/RetryAllButton";
import { ConnectorsTable } from "@/components/domain/connectors/ConnectorsTable";
import { toConnectorRow } from "@/lib/connector-rows";

type SearchParams = { msg?: string };

export const metadata = { title: "Connectors" };

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { msg } = await searchParams;
  let connectorData: Awaited<ReturnType<typeof fetchConnectors>> | null = null;
  let loadError: unknown = null;
  try {
    connectorData = await fetchConnectors();
  } catch (error) {
    loadError = error;
  }
  const count = connectorData?.count ?? 0;
  const connectors = connectorData?.connectors ?? [];
  const scheduler = connectorData?.scheduler;

  return (
    <>
      <PageHeader
        title="Connectors"
        subtitle={`${count} configured · poll AWS, SQS, and probe targets on a schedule`}
        actions={
          <div className="flex items-center gap-2">
            <RetryAllButton />
            <Button asChild variant="secondary" size="sm">
              <Link href="/connectors/advanced-queue">Advanced queue</Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/connectors/new">
                <Plus size={14} /> Add connector
              </Link>
            </Button>
          </div>
        }
      />

      {msg && (
        <div className="mb-4 border-l-2 border-signal bg-surface-1 px-3 py-2 text-xs text-fg-muted">
          <span className="text-signal">·</span> {msg}
        </div>
      )}

      {scheduler?.heartbeat_at && (
        <div className="mb-4 text-[11px] text-fg-subtle" role="status">
          scheduler heartbeat <TimestampCell value={scheduler.heartbeat_at} />
        </div>
      )}

      {loadError && (
        <div className="mb-4 border border-danger/50 bg-danger/5 px-4 py-3 text-sm">
          <h2 className="font-semibold text-danger">Connector service unavailable</h2>
          <p className="mt-1 text-muted">
            The UI could not read connector data from the API. Existing connector data was not changed.
          </p>
          <code className="mt-2 block text-xs opacity-80">
            {loadError instanceof Error && /failed: \d{3}/.test(loadError.message)
              ? loadError.message.replace(/^fetchConnectors failed: /, "API status: ")
              : "Check the backend logs and confirm the database migrations completed."}
          </code>
        </div>
      )}

      <DataPanel>
        {loadError ? (
          <div className="px-6 py-12 text-center text-sm text-fg-muted">
            Connector records will appear here when the API is healthy.
          </div>
        ) : connectors.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-fg-muted">
            No connectors yet.{" "}
            <Link href="/connectors/new" className="text-signal hover:underline">
              Add one →
            </Link>
          </div>
        ) : (
          <ConnectorsTable connectors={connectors.map(toConnectorRow)} />
        )}
      </DataPanel>
    </>
  );
}
