import Link from "next/link";
import clsx from "clsx";

import { fetchVpn } from "@/lib/api";
import type {
  EventEnvelope,
  VpnCertificate,
  VpnClient,
  VpnServer,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { VpnAuthTable, VpnCertsTable, VpnClientsTable } from "@/components/domain/VpnTables";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { IpCell } from "@/components/domain/IpCell";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { deleteVpnServerAction } from "./actions";

export const metadata = { title: "VPN" };

export default async function VpnPage() {
  const { servers, auth } = await fetchVpn();

  const activeCount = servers.filter((s) => s.active && !s.stale).length;
  const totalClients = servers.reduce((acc, s) => acc + s.client_count, 0);

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

      {servers.length === 0 ? (
        <DataPanel className="px-6 py-12 text-center">
          <p className="text-sm text-fg-muted">
            No VPN data yet. Install the on-host agent (
            <code className="text-fg">deploy/vpn/</code>) and add the SQS
            connector with target module{" "}
            <code className="text-fg">vpn.openvpn</code>.
          </p>
        </DataPanel>
      ) : (
        <div className="space-y-6">
          {servers.map((s) => (
            <ServerPanel key={s.server} server={s} />
          ))}
        </div>
      )}

      <section className="mt-6 space-y-2">
        <SectionLabel>recent auth attempts</SectionLabel>
        <DataPanel className="overflow-hidden">
          {auth.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-fg-muted">
              No auth attempts captured yet. Once anyone tries to log in to the
              VPN (success or failure), it appears here within a second or two.
            </div>
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
      </section>
    </>
  );
}

// =========================================================================
// per-server panel
// =========================================================================

function ServerPanel({ server: s }: { server: VpnServer }) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <SectionLabel>{s.server} · clients</SectionLabel>
            {s.stale && (
              <form action={deleteVpnServerAction} className="inline">
                <input type="hidden" name="server" value={s.server} />
                <ConfirmSubmitButton
                  variant="ghost"
                  size="sm"
                  confirmMessage={`Remove ${s.server} from the VPN read model? It will reappear if the agent reports again.`}
                  title={`Remove ${s.server} from the read model. Will reappear if an agent reports under this name again.`}
                  className="text-fg-subtle hover:text-sev-critical"
                >
                  remove
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
          <ServerStatusInline server={s} />
        </div>
        <DataPanel className="overflow-hidden">
          {s.clients.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-fg-muted">
              No clients connected.
            </div>
          ) : (
            <VpnClientsTable clients={s.clients} server={s.server} />
          )}
        </DataPanel>
      </div>

      <CertsBlock server={s.server} certs={s.certs ?? []} />
    </section>
  );
}

// =========================================================================
// certs — the actual reason the cert/CRL watcher exists
// =========================================================================

function CertsBlock({
  server,
  certs,
}: {
  server: string;
  certs: VpnCertificate[];
}) {
  if (certs.length === 0) {
    return (
      <div className="space-y-2">
        <SectionLabel>{server} · certificates</SectionLabel>
        <DataPanel className="px-6 py-8 text-center text-sm text-fg-muted">
          Agent hasn&apos;t shipped a cert inventory yet. Upgrade the on-host
          agent to v0.4+ — once a heartbeat lands, this fills in.
        </DataPanel>
      </div>
    );
  }

  // Sort by days_remaining ascending — the most urgent rows ride at the top.
  // Errors (no days_remaining) get pushed to the bottom.
  const sorted = [...certs].sort((a, b) => {
    const ad = a.days_remaining ?? Number.POSITIVE_INFINITY;
    const bd = b.days_remaining ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });

  const counts = countByBand(certs);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>
          {server} · certificates · {certs.length}{" "}
          {certs.length === 1 ? "entry" : "entries"}
        </SectionLabel>
        <span className="font-mono text-[11px] text-fg-subtle">
          {counts.expired > 0 && (
            <span className="mr-3 text-sev-critical">
              ● {counts.expired} expired
            </span>
          )}
          {counts.critical > 0 && (
            <span className="mr-3 text-sev-critical">
              ● {counts.critical} &lt;7d
            </span>
          )}
          {counts.high > 0 && (
            <span className="mr-3 text-sev-high">
              ● {counts.high} &lt;14d
            </span>
          )}
          {counts.warning > 0 && (
            <span className="mr-3 text-sev-medium">
              ● {counts.warning} &lt;30d
            </span>
          )}
          {counts.error > 0 && (
            <span className="mr-3 text-sev-medium">
              ● {counts.error} unreadable
            </span>
          )}
        </span>
      </div>
      <DataPanel className="overflow-hidden">
        <VpnCertsTable certs={sorted} server={server} />
      </DataPanel>
    </div>
  );
}

function countByBand(certs: VpnCertificate[]) {
  const c = { expired: 0, critical: 0, high: 0, warning: 0, error: 0 };
  for (const cert of certs) {
    if (cert.error) {
      c.error++;
      continue;
    }
    const d = cert.days_remaining;
    if (d == null) continue;
    if (d < 0) c.expired++;
    else if (d < 7) c.critical++;
    else if (d < 14) c.high++;
    else if (d < 30) c.warning++;
  }
  return c;
}

function ServerStatusInline({ server: s }: { server: VpnServer }) {
  const ok = s.active && !s.stale;
  return (
    <span className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
      <span
        aria-hidden
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          ok ? "bg-sev-resolved" : "bg-sev-critical",
        )}
      />
      <span className={ok ? "text-fg" : "text-sev-critical"}>
        {ok ? "active" : "down"}
      </span>
      {s.age_seconds !== null && (
        <>
          <span className="text-fg-subtle">·</span>
          <span className="text-fg-subtle">
            updated {s.age_seconds}s ago
          </span>
        </>
      )}
      {s.stale && (
        <span className="text-[10px] uppercase tracking-wider text-sev-medium">
          stale
        </span>
      )}
      <span className="text-fg-subtle">· {s.client_count} client{s.client_count === 1 ? "" : "s"}</span>
    </span>
  );
}

// =========================================================================
// auth attempts
// =========================================================================
