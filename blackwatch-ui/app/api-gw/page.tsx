import clsx from "clsx";

import {
  fetchApiGwSummary,
  fetchApiGwApis,
  fetchApiGwSources,
  fetchApiGwAlerts,
  fetchApiGwFailures,
} from "@/lib/api";
import type {
  ApiGwAlert,
  ApiGwApi,
  ApiGwSource,
  ApiGwFailure,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AlertsTable, ApisTable, FailuresTable, SourcesTable } from "@/components/domain/ApiGwTables";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ApiGwPage() {
  const [summary, apis, sources, alerts, failures] = await Promise.all([
    fetchApiGwSummary(),
    fetchApiGwApis(),
    fetchApiGwSources(100),
    fetchApiGwAlerts(24),
    fetchApiGwFailures(24),
  ]);

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="API Gateway"
        subtitle={
          summary.sources === 0 ? (
            "No API Gateway traffic ingested yet — deploy the log forwarder to start."
          ) : (
            <>
              {summary.sources} unique source{summary.sources === 1 ? "" : "s"} ·{" "}
              {summary.requests.toLocaleString()} request
              {summary.requests === 1 ? "" : "s"} ·{" "}
              <span className={summary.err_4xx > 0 ? "text-sev-medium" : "text-fg-muted"}>
                {summary.err_4xx.toLocaleString()} 4xx
              </span>
              {" · "}
              <span className={summary.err_5xx > 0 ? "text-sev-critical" : "text-fg-muted"}>
                {summary.err_5xx.toLocaleString()} 5xx
              </span>
              {alerts.count > 0 && (
                <>
                  {" · "}
                  <span className="text-sev-high">
                    {alerts.count} alert{alerts.count === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </>
          )
        }
        actions={<RefreshButton connectorTypes={["aws_api_gw_sqs"]} />}
      />

      {/* -------- Active APIs (top) --------------------------------------- */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>active APIs</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            one row per API name seen in the log stream ·{" "}
            <span className="font-mono text-fg-muted">{apis.count}</span>
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {apis.apis.length === 0 ? (
            <EmptyState>
              No APIs ingested yet. Configure a Gateway stage&apos;s access
              log to point at a log group under <code>/aws/gateway/*</code>{" "}
              and hook it into the BW forwarder.
            </EmptyState>
          ) : (
            <ApisTable apis={apis.apis} />
          )}
        </DataPanel>
      </section>

      {/* -------- Alerts --------------------------------------------------- */}
      <section className="mt-6 space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>alerts</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            new source · auth burst · scanner UA · 5xx burst · last {alerts.hours}h ·{" "}
            <span
              className={clsx(
                "font-mono",
                alerts.count > 0 ? "text-sev-high" : "text-fg-muted",
              )}
            >
              {alerts.count}
            </span>
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {alerts.alerts.length === 0 ? (
            <EmptyState>
              No credential-attack or new-source alerts. That&apos;s good — or
              the forwarder isn&apos;t running yet.
            </EmptyState>
          ) : (
            <AlertsTable alerts={alerts.alerts} />
          )}
        </DataPanel>
      </section>

      {/* -------- Source IPs ----------------------------------------------- */}
      <section className="mt-6 space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>source IPs</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            real client IPs · sorted by last seen ·{" "}
            <span className="font-mono text-fg-muted">{sources.count}</span>
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {sources.sources.length === 0 ? (
            <EmptyState>
              No API activity yet. Source IPs will populate as the forwarder
              Lambda drains logs into BW.
            </EmptyState>
          ) : (
            <SourcesTable sources={sources.sources} />
          )}
        </DataPanel>
      </section>

      {/* -------- Recent failures ----------------------------------------- */}
      <section className="mt-6 space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>failures (4xx auth + 5xx)</SectionLabel>
          <span className="text-[11px] text-fg-subtle">
            last {failures.hours}h ·{" "}
            <span
              className={clsx(
                "font-mono",
                failures.count > 0 ? "text-sev-medium" : "text-fg-muted",
              )}
            >
              {failures.count}
            </span>
          </span>
        </div>
        <DataPanel className="overflow-hidden">
          {failures.failures.length === 0 ? (
            <EmptyState>No failures. 🎉</EmptyState>
          ) : (
            <FailuresTable failures={failures.failures} />
          )}
        </DataPanel>
      </section>
    </>
  );
}
