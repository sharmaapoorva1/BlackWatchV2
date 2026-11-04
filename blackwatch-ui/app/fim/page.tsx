import Link from "next/link";
import clsx from "clsx";

import { fetchFimView } from "@/lib/api";
import type {
  FimHostRow,
  FimChangeWithInstance,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { FimChangesTable, FimHostsTable } from "@/components/domain/FimTables";
import { PageSection } from "@/components/layout/PageSection";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function FimPage() {
  const { count, hosts, recent_changes } = await fetchFimView();

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="File integrity monitoring"
        subtitle={
          `${count} host${count === 1 ? "" : "s"} monitored · ` +
          `inotify + auditd whodata + 6h baseline scan`
        }
      />

      <PageSection title="Monitored hosts" flush>
        <DataPanel className="overflow-hidden">
          {hosts.length === 0 ? (
            <EmptyState>
              No hosts are reporting FIM data yet. Install the EC2 agent
              (v1.3+) — FIM auto-enables on first start.
            </EmptyState>
          ) : (
            <FimHostsTable hosts={hosts} now={Date.now()} />
          )}
        </DataPanel>
      </PageSection>

      <PageSection
        title="Recent file integrity activity"
        description={`Last ${recent_changes.length} change${recent_changes.length === 1 ? "" : "s"} across all hosts.`}
      >
        <DataPanel className="overflow-hidden">
          {recent_changes.length === 0 ? (
            <EmptyState>
              No file integrity changes recorded across any host. Either the
              agents just established their baselines or nothing has drifted.
            </EmptyState>
          ) : (
            <FimChangesTable changes={recent_changes} scope="all-hosts" />
          )}
        </DataPanel>
      </PageSection>
    </>
  );
}
