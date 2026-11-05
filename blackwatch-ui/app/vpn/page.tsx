import { fetchVpn } from "@/lib/api";
import type { VpnServer } from "@/lib/types";
import { buildVpnCards, certSummary, countByBand, serverOk, sortCerts } from "@/lib/vpn-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { VpnAuthTable, VpnCertsTable, VpnClientsTable } from "@/components/domain/VpnTables";
import { StatCard } from "@/components/domain/OverviewParts";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { deleteVpnServerAction } from "./actions";

export const metadata = { title: "VPN" };

/**
 * VPN, in the order an operator works:
 *   1. VPN health      : servers, clients, certificate expiry, failed logins
 *   2. Servers         : one collapsible block per server (clients + certificates)
 *   3. Auth attempts   : recent logins, success and failure
 * h1 page, h2 section, h3 server.
 */
export default async function VpnPage() {
  const { servers, auth } = await fetchVpn();

  const activeCount = servers.filter(serverOk).length;
  const totalClients = servers.reduce((acc, s) => acc + s.client_count, 0);
  const cards = buildVpnCards(servers, auth);

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

            <Section id="servers" title="Servers" description="Connected clients and certificates for each server. Problem servers start open.">
              {servers.map((s) => (
                <ServerBlock key={s.server} server={s} total={servers.length} />
              ))}
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

function ServerBlock({ server: s, total }: { server: VpnServer; total: number }) {
  const certs = s.certs ?? [];
  const bands = countByBand(certs);
  const certProblem = bands.expired + bands.critical + bands.high > 0;
  const status = serverOk(s) ? "active" : s.stale ? "stale" : "down";
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
            <VpnCertsTable certs={sortCerts(certs)} server={s.server} />
          )}
        </DataPanel>
      </div>
    </Subsection>
  );
}
