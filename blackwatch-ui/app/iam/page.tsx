import Link from "next/link";

import { fetchIam } from "@/lib/api";
import type { EventEnvelope } from "@/lib/types";
import { buildIamCards } from "@/lib/iam-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { IamEventsTable, IamPostureEventsTable } from "@/components/domain/IamTables";
import { toIamPostureRow, toIamRow } from "@/lib/iam-rows";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { StatCard } from "@/components/domain/OverviewParts";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "IAM" };

export default async function IamPage() {
  const data = await fetchIam();
  const cards = buildIamCards(data.counts);

  return (
    <>
      <AutoRefresh intervalMs={10_000} />

      <PageHeader
        title="IAM · AWS control plane"
        subtitle="Everything CloudTrail records — logins, IAM, network, storage, KMS, audit integrity. Host SSH/sudo and VPN auth live on /hosts and /vpn."
        actions={<RefreshButton connectorTypes={["aws_cloudtrail_sqs"]} />}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Needs attention" description="Last 24 hours. Select a card to open the events behind it.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="access" title="Access and configuration" description="Who signed in, and what changed in identity, keys and secrets.">
          <EventsBlock
            id="iam-logins"
            title="Console and SSO logins"
            subtitle="AWS console sign-ins (IAM and root) and federated SAML or WebIdentity logins"
            events={data.logins}
            showOutcome
            showSourceIp
            showLoginKind
            emptyHint="No console or federated logins captured in the recent window."
          />
          <EventsBlock
            id="iam-changes"
            title="IAM changes"
            subtitle="users, roles, groups, policies, access keys, MFA, login profiles, permission boundaries"
            events={data.iam_changes}
            showTarget
            emptyHint="No IAM changes in the recent window."
          />
          <EventsBlock
            id="iam-kms"
            title="KMS and secrets"
            subtitle="key create, enable or disable, key policy, grants, rotation, scheduled deletion"
            events={data.kms_changes}
            showTarget
            emptyHint="No KMS changes in the recent window."
          />
        </Section>

        <Section id="network" title="Network and exposure" description="Changes to network rules, topology, and what is reachable from outside.">
          <EventsBlock
            id="iam-exposure"
            title="Storage and compute exposure"
            subtitle="S3 ACL, S3 policy, block public access, public snapshot, public AMI, IMDSv1 enabled"
            events={data.storage_exposure}
            showTarget
            showExposureDetail
            emptyHint="No storage or compute exposure changes. Nothing was made public."
            emptyTone="ok"
          />
          <EventsBlock
            id="iam-sg"
            title="Security group changes"
            subtitle="ingress, egress, create, delete, instance attach"
            events={data.sg_changes}
            showTarget
            showSgDetail
            emptyHint="No security group changes in the recent window."
          />
          <EventsBlock
            id="iam-topology"
            title="Network topology"
            subtitle="VPC, internet gateway, NAT, route, NACL, peering: the shape of the network, not its rules"
            events={data.network_topology}
            showTarget
            emptyHint="No topology changes. VPCs, gateways, routes and peerings are stable."
            emptyTone="ok"
          />
        </Section>

        <Section id="audit" title="Audit integrity and posture" description="The audit trail itself, and new posture findings.">
          <EventsBlock
            id="iam-tamper"
            title="CloudTrail tamper"
            subtitle="anyone touching the audit trail itself; should always be empty"
            events={data.ct_tamper}
            showTarget
            emptyHint="Clean. Nobody has stopped logging or modified a trail."
            emptyTone="ok"
          />
          <PostureFindingsBlock events={data.posture_findings_new} />
        </Section>
      </div>
    </>
  );
}

// =========================================================================
// reusable section
// =========================================================================

interface EventsBlockProps {
  id: string;
  title: string;
  subtitle?: string;
  events: EventEnvelope[];
  showOutcome?: boolean;
  showSourceIp?: boolean;
  showTarget?: boolean;
  showSgDetail?: boolean;
  showExposureDetail?: boolean;
  showLoginKind?: boolean;
  emptyHint?: string;
  emptyTone?: "neutral" | "ok";
}

/** One event stream as a collapsible h3. Streams with events start open. */
function EventsBlock({
  id,
  title,
  subtitle,
  events,
  showOutcome,
  showSourceIp,
  showTarget,
  showSgDetail,
  showExposureDetail,
  showLoginKind,
  emptyHint,
  emptyTone = "neutral",
}: EventsBlockProps) {
  return (
    <Subsection id={id} title={title} count={events.length} summary={subtitle} defaultOpen={events.length > 0}>
      <DataPanel className="overflow-hidden">
        {events.length === 0 ? (
          <EmptyState tone={emptyTone}>{emptyHint ?? "Nothing here."}</EmptyState>
        ) : (
          <IamEventsTable
            rows={events.map((e) => toIamRow(e, showSgDetail ? "sg" : showExposureDetail ? "exposure" : "plain"))}
            tableId={`iam-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v2`}
            ariaLabel={title}
            showOutcome={showOutcome}
            showSourceIp={showSourceIp}
            showTarget={showTarget}
            showSgDetail={showSgDetail}
            showExposureDetail={showExposureDetail}
            showLoginKind={showLoginKind}
          />
        )}
      </DataPanel>
    </Subsection>
  );
}

// =========================================================================
// posture findings: links to /aws-posture for the full list
// =========================================================================

function PostureFindingsBlock({ events }: { events: EventEnvelope[] }) {
  return (
    <Subsection
      id="iam-posture"
      title="New posture findings"
      count={events.length}
      summary={
        <Link href="/aws-posture" className="hover:text-fg">
          full posture
        </Link>
      }
      defaultOpen={events.length > 0}
    >
      <DataPanel className="overflow-hidden">
        {events.length === 0 ? (
          <EmptyState tone="ok">No new posture findings in the recent window.</EmptyState>
        ) : (
          <IamPostureEventsTable rows={events.map(toIamPostureRow)} />
        )}
      </DataPanel>
    </Subsection>
  );
}
