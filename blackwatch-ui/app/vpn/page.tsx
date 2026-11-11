import { fetchVpn } from "@/lib/api";
import type { VpnServer } from "@/lib/types";
import { buildVpnCards, certSummary, countByBand, renewalQueue, renewedNotDeployed, serverOk, sortCerts } from "@/lib/vpn-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { VpnAuthTable, VpnCertsTable, VpnClientsTable, VpnRenewalTable, VpnSessionsTable } from "@/components/domain/VpnTables";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { deleteVpnServerAction } from "./actions";

export const metadata = { title: "VPN" };

/**
 * VPN, in the order an operator works:
 *   1. VPN health   : servers, clients, certificate renewals, failed logins
 *   2. Certificates : what to renew next, and anything renewed but not deployed
 *   3. Servers      : one collapsible block per server (clients + certificates)
 *   4. Sessions     : who connected, from where, and for how long
 *   5. Auth         : recent login attempts, success and failure
 * h1 page, h2 section, h3 server.
 */
export default async function VpnPage() {
  const { servers, auth, sessions = [] } = await fetchVpn();

  // One timestamp for every "days left" so the server render and the browser agree.
  const now = Date.now();
  const activeCount = servers.filter(serverOk).length;
  const totalClients = servers.reduce((acc, s) => acc + s.client_count, 0);
  const cards = buildVpnCards(servers, auth, now);
  const renewals = renewalQueue(servers, now);
  const mismatches = renewedNotDeployed(servers, now);

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader
        title="VPN"
        subtitle={
          servers.length === 0
            ? "No VPN data yet."
            : `${activeCount}/${servers.length} server${servers.length === 1 ? "" : "s"} active · ${totalClients} client${totalClients === 1 ? "" : "s"} connected`
        }
        actions={<RefreshButton connectorTypes={["aws_cloudtrail_sqs"]} />}
      />

      <div className="flex min-w-0 flex-col gap-10">
        {servers.length === 0 ? (
          <Section id="servers" title="Servers">
            <DataPanel>
              <EmptyState>
                No VPN data yet. Install the on-host agent (<code className="text-fg">deploy/vpn/</code>) and add the SQS
                connector with target module <code className="text-fg">vpn.openvpn</code>.
              </EmptyState>
            </DataPanel>
          </Section>
        ) : (
          <>
            <Section id="health" title="VPN health" description="Servers reporting, who is connected, certificates running out, and failed logins.">
              <AutoGrid min="15rem">
                {cards.map((card) => (
                  <StatCard key={card.id} card={card} />
                ))}
              </AutoGrid>
            </Section>

            <Section
              id="certificates"
              title="Certificates"
              description="Renew the first row first. Days are counted from each certificate's expiry date, so they stay correct even if an agent goes quiet."
            >
              {mismatches.length > 0 && (
                <div role="alert" className="rounded-md border border-sev-high/40 bg-sev-high/5 px-4 py-3 text-sm">
                  <p className="font-medium text-sev-high">Renewed but not deployed</p>
                  <ul className="mt-1 space-y-0.5 text-fg-muted">
                    {mismatches.map((m) => (
                      <li key={`${m.server}-${m.name}`}>
                        <code className="text-fg">{m.name}</code> on {m.server}: OpenVPN is still using the old copy, which expires in{" "}
                        {Math.max(m.liveDays, 0).toFixed(0)} days. The renewed copy is good for {m.renewedDays.toFixed(0)}. Copy it to the OpenVPN
                        directory and restart.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <DataPanel className="overflow-hidden">
                {renewals.length === 0 ? (
                  <EmptyState tone="ok">Every certificate has more than 30 days left.</EmptyState>
                ) : (
                  <VpnRenewalTable items={renewals} now={now} />
                )}
              </DataPanel>
            </Section>

            <Section id="servers" title="Servers" description="Connected clients and certificates for each server. Problem servers start open.">
              {servers.map((s) => (
                <ServerBlock key={s.server} server={s} total={servers.length} now={now} mismatchNames={mismatches.filter((m) => m.server === s.server).map((m) => m.name)} />
              ))}
            </Section>

            <Section id="sessions" title="Recent sessions" description="Who connected, from where, and for how long. Sessions shorter than a minute can be missed.">
              <DataPanel className="overflow-hidden">
                {sessions.length === 0 ? (
                  <EmptyState>No sessions recorded yet. They appear as clients connect and disconnect.</EmptyState>
                ) : (
                  <VpnSessionsTable sessions={sessions} now={now} />
                )}
              </DataPanel>
            </Section>
          </>
        )}

        <Section id="auth" title="Recent auth attempts" description="Every login try, success or failure. New attempts appear within a second or two.">
          <DataPanel className="overflow-hidden">
            {auth.length === 0 ? (
              <EmptyState>No auth attempts captured yet.</EmptyState>
            ) : (
              <VpnAuthTable
                rows={auth.map((a) => ({
                  event_id: a.event_id,
                  event_time: a.event_time,
                  outcome: a.outcome ?? null,
                  principal: a.actor?.principal ?? null,
                  source_ip: (a.actor as { source_ip?: string } | undefined)?.source_ip ?? null,
                }))}
              />
            )}
          </DataPanel>
        </Section>
      </div>
    </>
  );
}

function ServerBlock({ server: s, total, now, mismatchNames }: { server: VpnServer; total: number; now: number; mismatchNames: string[] }) {
  const certs = s.certs ?? [];
  const bands = countByBand(certs, now);
  const certProblem = bands.expired + bands.critical + bands.high > 0 || mismatchNames.length > 0;
  const status = serverOk(s) ? "active" : s.agent_stale ? "agent silent" : s.stale ? "stale" : "down";
  const summary = [
    status,
    s.age_seconds !== null ? `updated ${s.age_seconds}s ago` : null,
    `${s.client_count} client${s.client_count === 1 ? "" : "s"}`,
    certSummary(bands) || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Subsection
      id={`server-${s.server}`}
      title={s.server}
      count={s.client_count}
      summary={summary}
      defaultOpen={!serverOk(s) || certProblem || total <= 3}
    >
      {s.stale && (
        <form action={deleteVpnServerAction}>
          <input type="hidden" name="server" value={s.server} />
          <ConfirmSubmitButton
            variant="secondary"
            size="sm"
            confirmMessage={`Remove ${s.server} from the VPN read model? It will reappear if the agent reports again.`}
            title="Remove from the read model. Reappears if an agent reports under this name again."
          >
            Remove stale server
          </ConfirmSubmitButton>
        </form>
      )}
      <div className="space-y-2">
        <SectionLabel>Connected clients</SectionLabel>
        <DataPanel className="overflow-hidden">
          {s.clients.length === 0 ? (
            <EmptyState>No clients connected.</EmptyState>
          ) : (
            <VpnClientsTable clients={s.clients} server={s.server} />
          )}
        </DataPanel>
      </div>
      <div className="space-y-2">
        <SectionLabel>Certificates ({certs.length})</SectionLabel>
        <DataPanel className="overflow-hidden">
          {certs.length === 0 ? (
            <EmptyState>
              The agent has not shipped a certificate inventory yet. Upgrade the on-host agent to v0.4+; once a heartbeat lands, this fills in.
            </EmptyState>
          ) : (
            <VpnCertsTable certs={sortCerts(certs, now)} server={s.server} now={now} notDeployed={mismatchNames} />
          )}
        </DataPanel>
      </div>
    </Subsection>
  );
}
