import clsx from "clsx";

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
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import { FlashToast } from "@/components/ui/FlashToast";
import { PendingButton } from "@/components/ui/PendingButton";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { addAllowlistUserAction } from "./allowlist-actions";

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

      {/* -------- Shape-B alerts (top, because they're the real signal) --- */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>shape-B alerts</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            new source · new user+ip · unknown user · last {shapeB.hours}h ·{" "}
            <span
              className={clsx(
                "font-mono",
                shapeB.count > 0 ? "text-sev-high" : "text-fg-muted",
              )}
            >
              {shapeB.count}
            </span>
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {shapeB.alerts.length === 0 ? (
            <EmptyState>
              No stolen-credential or new-source alerts. That&apos;s good —
              or your allowlist is too permissive.
            </EmptyState>
          ) : (
            <ShapeBAlertsTable alerts={shapeB.alerts} />
          )}
        </DataPanel>
      </section>

      {/* -------- Proxy source IPs (real client IPs) ---------------------- */}
      <section className="mt-6 space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>proxy source IPs</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            real client IPs seen at the RDS Proxy ·{" "}
            <span className="font-mono text-fg-muted">{sources.count}</span>
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {sources.sources.length === 0 ? (
            <EmptyState>
              No proxy connects observed yet. New IPs will appear here as
              they connect (and fire rds.proxy.source.new the first time).
            </EmptyState>
          ) : (
            <ProxySourcesTable sources={sources.sources} />
          )}
        </DataPanel>
      </section>

      {/* -------- Databases summary --------------------------------------- */}
      <section className="mt-6 space-y-2">
        <SectionLabel>databases</SectionLabel>
        <DataPanel className="overflow-hidden">
          {summary.databases.length === 0 ? (
            <EmptyState>
              Nothing here yet. Once the log-forwarder Lambda is subscribed
              to your RDS log groups and the BW connector is enabled,
              sessions + auth failures will flow into this page.
            </EmptyState>
          ) : (
            <DatabasesTable databases={summary.databases} />
          )}
        </DataPanel>
      </section>

      {/* -------- Currently connected ------------------------------------- */}
      <section className="mt-6 space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>currently connected</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            <span className="font-mono text-fg-muted">{live.count}</span>{" "}
            active
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {live.sessions.length === 0 ? (
            <EmptyState>No active sessions right now.</EmptyState>
          ) : (
            <SessionsTable sessions={live.sessions} live />
          )}
        </DataPanel>
      </section>

      {/* -------- Session history (collapsed) ----------------------------- */}
      <section className="mt-6 space-y-2">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-baseline justify-between rounded-md border border-line-soft bg-surface-1 px-4 py-2.5 hover:bg-surface-2">
            <span className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="text-fg-subtle transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              <span className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                session history
              </span>
              <span className="text-xs text-fg-muted">last 24h</span>
            </span>
            <span className="text-[11px] text-fg-subtle">
              <span className="font-mono text-fg-muted">{history.count}</span>{" "}
              sessions
            </span>
          </summary>
          <DataPanel className="mt-2 overflow-hidden">
            {history.sessions.length === 0 ? (
              <EmptyState>No session history in the last 24h.</EmptyState>
            ) : (
              <SessionsTable sessions={history.sessions} />
            )}
          </DataPanel>
        </details>
      </section>

      {/* -------- Auth failures ------------------------------------------- */}
      <section className="mt-6 space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>auth failures</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            last {auth.hours}h ·{" "}
            <span
              className={clsx(
                "font-mono",
                auth.count > 0 ? "text-sev-critical" : "text-fg-muted",
              )}
            >
              {auth.count}
            </span>
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {auth.failures.length === 0 ? (
            <EmptyState>No auth failures. 🎉</EmptyState>
          ) : (
            <AuthFailuresTable failures={auth.failures} />
          )}
        </DataPanel>
      </section>

      {/* -------- User allowlist (collapsed) ------------------------------ */}
      <section className="mt-6 space-y-2">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-baseline justify-between rounded-md border border-line-soft bg-surface-1 px-4 py-2.5 hover:bg-surface-2">
            <span className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="text-fg-subtle transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              <span className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                user allowlist
              </span>
              <span className="text-xs text-fg-muted">
                users NOT on this list fire rds.user.unknown
              </span>
            </span>
            <span className="text-[11px] text-fg-subtle">
              <span className="font-mono text-fg-muted">{humans.length}</span>{" "}
              humans ·{" "}
              <span className="font-mono text-fg-muted">
                {services.length}
              </span>{" "}
              services
            </span>
          </summary>
          <div className="mt-2 space-y-4">
            <AllowlistManager
              humans={humans}
              services={services}
            />
          </div>
        </details>
      </section>
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
        <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
          {heading}
        </div>
        <div className="text-xs text-fg-muted">{empty}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
        {heading} · {entries.length}
      </div>
      <AllowlistEntriesTable entries={entries} kind={heading.toLowerCase().replaceAll(" ", "-")} />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center text-sm text-fg-muted">
      {children}
    </div>
  );
}
