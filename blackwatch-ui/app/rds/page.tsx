import {
  fetchRdsSummary,
  fetchRdsLive,
  fetchRdsSessions,
  fetchRdsAuthFailures,
  fetchRdsProxySources,
  fetchRdsShapeB,
  fetchRdsAllowlist,
} from "@/lib/api";
import type {
  RdsAuthFailure,
  RdsDbSummary,
  RdsSession,
  RdsProxySource,
  RdsShapeBAlert,
  RdsAllowlistEntry,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import {
  AllowlistEntriesTable,
  AuthFailuresTable,
  DatabasesTable,
  ProxySourcesTable,
  SessionsTable,
  ShapeBAlertsTable,
} from "@/components/domain/RdsTables";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";
import { allowlistSummary, buildRdsCards } from "@/lib/rds-view";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { FlashToast } from "@/components/ui/FlashToast";
import { PendingButton } from "@/components/ui/PendingButton";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { addAllowlistUserAction } from "./allowlist-actions";

export const metadata = { title: "RDS" };

export default async function RdsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const params = await searchParams;
  const [summary, live, history, auth, sources, shapeB, allowlist] =
    await Promise.all([
      fetchRdsSummary(),
      fetchRdsLive(),
      fetchRdsSessions(24),
      fetchRdsAuthFailures(24),
      fetchRdsProxySources(50),
      fetchRdsShapeB(24),
      fetchRdsAllowlist(),
    ]);

  const totalActive = summary.databases.reduce((n, d) => n + d.active, 0);
  const cards = buildRdsCards({
    databases: summary.databases.length,
    active: totalActive,
    authFailures: auth.count,
    authHours: auth.hours,
    alerts: shapeB.count,
    alertHours: shapeB.hours,
    sources: sources.count,
  });
  const humans = allowlist.users.filter((u) => u.kind === "human");
  const services = allowlist.users.filter((u) => u.kind === "service");

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      {params?.msg && <FlashToast message={params.msg} />}
      <PageHeader
        title="RDS"
        subtitle={
          summary.databases.length === 0
            ? "No RDS activity ingested yet — deploy the log forwarder to start."
            : (
              <>
                {totalActive} active session{totalActive === 1 ? "" : "s"} ·{" "}
                {summary.auth_failures_24h_total} auth failure
                {summary.auth_failures_24h_total === 1 ? "" : "s"} in the last
                24h
                {shapeB.count > 0 && (
                  <>
                    {" · "}
                    <span className="text-sev-high">
                      {shapeB.count} Shape-B alert{shapeB.count === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </>
            )
        }
        actions={<RefreshButton connectorTypes={["aws_rds_sqs"]} />}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Database health" description="Credential alerts and failed logins first. Select a card to jump to the details.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="alerts" title="Credential alerts" description={`New source, new user+IP and unknown user, last ${shapeB.hours}h.`}>
          <DataPanel className="overflow-hidden">
            {shapeB.alerts.length === 0 ? (
              <EmptyState tone="ok">No stolen-credential or new-source alerts. That is good, or your allowlist is too permissive.</EmptyState>
            ) : (
              <ShapeBAlertsTable alerts={shapeB.alerts} />
            )}
          </DataPanel>
        </Section>

        <Section id="auth" title="Auth failures" description={`Failed database logins, last ${auth.hours}h.`}>
          <DataPanel className="overflow-hidden">
            {auth.failures.length === 0 ? (
              <EmptyState tone="ok">No auth failures in this window.</EmptyState>
            ) : (
              <AuthFailuresTable failures={auth.failures} />
            )}
          </DataPanel>
        </Section>

        <Section id="connected" title="Sessions" description="Who is connected now, and recent history.">
          <Subsection id="sessions-live" title="Currently connected" count={live.count}>
            <DataPanel className="overflow-hidden">
              {live.sessions.length === 0 ? <EmptyState>No active sessions right now.</EmptyState> : <SessionsTable sessions={live.sessions} live />}
            </DataPanel>
          </Subsection>
          <Subsection id="sessions-history" title="Session history" count={history.count} summary="last 24h" defaultOpen={false}>
            <DataPanel className="overflow-hidden">
              {history.sessions.length === 0 ? (
                <EmptyState>No session history in the last 24h.</EmptyState>
              ) : (
                <SessionsTable sessions={history.sessions} />
              )}
            </DataPanel>
          </Subsection>
        </Section>

        <Section id="sources" title="Proxy source IPs" description={`Real client IPs seen at the RDS Proxy (${sources.count}).`}>
          <DataPanel className="overflow-hidden">
            {sources.sources.length === 0 ? (
              <EmptyState>No proxy connects observed yet. New IPs appear as they connect (and fire rds.proxy.source.new the first time).</EmptyState>
            ) : (
              <ProxySourcesTable sources={sources.sources} />
            )}
          </DataPanel>
        </Section>

        <Section id="databases" title="Databases" description="Activity per database instance.">
          <DataPanel className="overflow-hidden">
            {summary.databases.length === 0 ? (
              <EmptyState>
                Nothing here yet. Once the log-forwarder Lambda is subscribed to your RDS log groups and the BW connector is enabled, sessions and auth
                failures flow into this page.
              </EmptyState>
            ) : (
              <DatabasesTable databases={summary.databases} />
            )}
          </DataPanel>
        </Section>

        <Section id="allowlist" title="User allowlist" description="Users not on this list fire rds.user.unknown.">
          <Subsection id="allowlist-manage" title="Allowed users" summary={allowlistSummary(humans.length, services.length)} defaultOpen={false}>
            <AllowlistManager humans={humans} services={services} />
          </Subsection>
        </Section>
      </div>
    </>
  );
}

// =========================================================================
// Allowlist manager
// =========================================================================

function AllowlistManager({
  humans,
  services,
}: {
  humans: RdsAllowlistEntry[];
  services: RdsAllowlistEntry[];
}) {
  return (
    <div className="space-y-4">
      <DataPanel className="overflow-hidden">
        <form action={addAllowlistUserAction} className="border-b border-line-soft p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              name="username"
              placeholder="username (e.g. aravinda_jatavallabha)"
              aria-label="Allowlist username"
              className="min-w-0 flex-1 font-mono text-xs"
              required
            />
            <NativeSelect
              name="kind"
              defaultValue="human"
              aria-label="Allowlist entry type"
              className="h-8 rounded px-3 text-xs"
            >
              <option value="human">human</option>
              <option value="service">service</option>
            </NativeSelect>
            <Input
              name="note"
              placeholder="note (optional)"
              aria-label="Allowlist note"
              className="min-w-0 flex-1 text-xs"
            />
            <PendingButton className="rounded border border-signal bg-signal/10 px-3 py-1.5 text-xs text-signal hover:bg-signal/20">
              Add
            </PendingButton>
          </div>
        </form>
        <AllowlistTable
          entries={humans}
          heading="Humans"
          empty="No humans on the allowlist. Add real people here so they don't trigger rds.user.unknown."
        />
      </DataPanel>
      <DataPanel className="overflow-hidden">
        <AllowlistTable
          entries={services}
          heading="Service accounts"
          empty="No service accounts allowlisted. Add app pool users (application_user, ai_gateway_user, etc.) so their traffic doesn't trigger alerts."
        />
      </DataPanel>
    </div>
  );
}

function AllowlistTable({
  entries,
  heading,
  empty,
}: {
  entries: RdsAllowlistEntry[];
  heading: string;
  empty: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="px-4 py-6">
        <div className="mb-2 text-xs text-fg-subtle">
          {heading}
        </div>
        <div className="text-xs text-fg-muted">{empty}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-xs text-fg-subtle">
        {heading} · {entries.length}
      </div>
      <AllowlistEntriesTable entries={entries} kind={heading.toLowerCase().replaceAll(" ", "-")} />
    </div>
  );
}
