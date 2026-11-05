import {
  fetchApiGwSummary,
  fetchApiGwApis,
  fetchApiGwSources,
  fetchApiGwAlerts,
  fetchApiGwFailures,
} from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AlertsTable, ApisTable, FailuresTable, SourcesTable } from "@/components/domain/ApiGwTables";
import { AutoGrid, Section } from "@/components/layout/Section";
import { StatCard } from "@/components/domain/OverviewParts";
import { buildApiGwCards } from "@/lib/apigw-view";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "API Gateway" };

export default async function ApiGwPage() {
  const [summary, apis, sources, alerts, failures] = await Promise.all([
    fetchApiGwSummary(),
    fetchApiGwApis(),
    fetchApiGwSources(100),
    fetchApiGwAlerts(24),
    fetchApiGwFailures(24),
  ]);

  const cards = buildApiGwCards(summary, alerts.count, alerts.hours, failures.count, failures.hours);

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

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Traffic health" description="Alerts and errors first. Select a card to jump to the details.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section
          id="alerts"
          title="Alerts"
          description={`New source, auth burst, scanner user agent and 5xx burst, last ${alerts.hours}h.`}
        >
          <DataPanel className="overflow-hidden">
            {alerts.alerts.length === 0 ? (
              <EmptyState tone="ok">No credential-attack or new-source alerts. That is good, or the forwarder is not running yet.</EmptyState>
            ) : (
              <AlertsTable alerts={alerts.alerts} />
            )}
          </DataPanel>
        </Section>

        <Section id="failures" title="Failures" description={`Auth (4xx) and server (5xx) failures, last ${failures.hours}h.`}>
          <DataPanel className="overflow-hidden">
            {failures.failures.length === 0 ? (
              <EmptyState tone="ok">No failures in this window.</EmptyState>
            ) : (
              <FailuresTable failures={failures.failures} />
            )}
          </DataPanel>
        </Section>

        <Section id="apis" title="Active APIs" description={`One row per API name seen in the log stream (${apis.count}).`}>
          <DataPanel className="overflow-hidden">
            {apis.apis.length === 0 ? (
              <EmptyState>
                No APIs ingested yet. Point a Gateway stage&apos;s access log at a log group under <code>/aws/gateway/*</code> and hook it into
                the BW forwarder.
              </EmptyState>
            ) : (
              <ApisTable apis={apis.apis} />
            )}
          </DataPanel>
        </Section>

        <Section id="sources" title="Source IPs" description={`Real client IPs, most recently seen first (${sources.count}).`}>
          <DataPanel className="overflow-hidden">
            {sources.sources.length === 0 ? (
              <EmptyState>No API activity yet. Source IPs appear as the forwarder drains logs into BW.</EmptyState>
            ) : (
              <SourcesTable sources={sources.sources} />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}
