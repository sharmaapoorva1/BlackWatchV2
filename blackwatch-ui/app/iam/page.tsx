import Link from "next/link";
import clsx from "clsx";

import { fetchIam } from "@/lib/api";
import type { EventEnvelope, IamCounts } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { IamEventsTable, IamPostureEventsTable } from "@/components/domain/IamTables";
import { toIamPostureRow, toIamRow } from "@/lib/iam-rows";
import { SectionLabel } from "@/components/layout/SectionLabel";
import { AutoRefresh } from "@/components/layout/AutoRefresh";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { TimestampCell } from "@/components/domain/TimestampCell";
import {
  SeverityBadge,
  severityBorderBg,
} from "@/components/domain/SeverityBadge";
import { IpCell } from "@/components/domain/IpCell";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "IAM" };

export default async function IamPage() {
  const data = await fetchIam();

  return (
    <>
      <AutoRefresh intervalMs={10_000} />

      <PageHeader
        title="IAM · AWS control plane"
        subtitle="Everything CloudTrail records — logins, IAM, network, storage, KMS, audit integrity. Host SSH/sudo and VPN auth live on /hosts and /vpn."
        actions={<RefreshButton connectorTypes={["aws_cloudtrail_sqs"]} />}
      />

      <CountersStrip counts={data.counts} />

      <EventsSection
        title="console + sso logins"
        subtitle="AWS console sign-ins (IAM + root) and federated SAML / WebIdentity logins"
        events={data.logins}
        showOutcome
        showSourceIp
        showLoginKind
        emptyHint="No console or federated logins captured in the recent window."
      />

      <EventsSection
        title="iam changes"
        subtitle="users · roles · groups · policies · access keys · MFA · login profiles · permission boundaries"
        events={data.iam_changes}
        showTarget
        emptyHint="No IAM changes in the recent window."
      />

      <EventsSection
        title="security group changes"
        subtitle="ingress / egress / create / delete / instance attach"
        events={data.sg_changes}
        showTarget
        showSgDetail
        emptyHint="No SG changes in the recent window."
      />

      <EventsSection
        title="network topology"
        subtitle="vpc · igw · nat · route · nacl · peering — the SHAPE of the network, not its rules"
        events={data.network_topology}
        showTarget
        emptyHint="No topology changes — VPCs, gateways, routes, and peerings are stable."
        emptyTone="ok"
      />

      <EventsSection
        title="storage / compute exposure"
        subtitle="S3 ACL · S3 policy · BPA · snapshot public · AMI public · IMDSv1 enabled"
        events={data.storage_exposure}
        showTarget
        showExposureDetail
        emptyHint="No storage / compute exposure changes — nothing was made public."
        emptyTone="ok"
      />

      <EventsSection
        title="kms / secrets"
        subtitle="key create · enable / disable · key policy · grants · rotation · scheduled deletion"
        events={data.kms_changes}
        showTarget
        emptyHint="No KMS changes in the recent window."
      />

      <PostureFindingsSection events={data.posture_findings_new} />

      <EventsSection
        title="cloudtrail tamper · audit"
        subtitle="anyone touching the audit trail itself · should always be empty"
        events={data.ct_tamper}
        showTarget
        emptyHint="Clean — nobody has stopped logging or modified a trail."
        emptyTone="ok"
      />
    </>
  );
}

// =========================================================================
// counters strip — 10 cells, wraps as 2 rows of 5
// =========================================================================

function CountersStrip({ counts }: { counts: IamCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      <CounterCell
        label="Logins · ok"
        value={counts.logins_ok}
        accent="neutral"
      />
      <CounterCell
        label="Logins · failed"
        value={counts.logins_failed}
        accent={
          counts.logins_failed >= 5
            ? "critical"
            : counts.logins_failed > 0
              ? "medium"
              : "ok"
        }
      />
      <CounterCell
        label="Logins · root"
        value={counts.logins_root}
        accent={counts.logins_root > 0 ? "critical" : "ok"}
      />
      <CounterCell
        label="Logins · sso"
        value={counts.logins_sso}
        accent="neutral"
      />
      <CounterCell
        label="MFA disabled"
        value={counts.mfa_disabled}
        accent={counts.mfa_disabled > 0 ? "critical" : "ok"}
      />
      <CounterCell
        label="IAM changes"
        value={counts.iam_changes}
        accent={counts.iam_changes > 0 ? "neutral" : "ok"}
      />
      <CounterCell
        label="SG changes"
        value={counts.sg_changes}
        accent={counts.sg_changes > 0 ? "neutral" : "ok"}
      />
      <CounterCell
        label="Network topology"
        value={counts.network_topology}
        accent={counts.network_topology > 0 ? "medium" : "ok"}
      />
      <CounterCell
        label="Storage exposure"
        value={counts.storage_exposure}
        accent={
          counts.storage_exposure > 0 ? "critical" : "ok"
        }
      />
      <CounterCell
        label="KMS changes"
        value={counts.kms_changes}
        accent={counts.kms_changes > 0 ? "medium" : "ok"}
      />
      <CounterCell
        label="CT tamper"
        value={counts.ct_tamper}
        accent={counts.ct_tamper > 0 ? "critical" : "ok"}
      />
    </div>
  );
}

type Accent = "ok" | "neutral" | "medium" | "critical";

function CounterCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: Accent;
}) {
  const dot =
    accent === "critical"
      ? "bg-sev-critical"
      : accent === "medium"
        ? "bg-sev-medium"
        : accent === "ok"
          ? "bg-sev-resolved"
          : "bg-fg-subtle";
  return (
    <div className="rounded-md border border-line-soft bg-surface-1 px-3 py-2.5">
      <div className="truncate text-[11px] uppercase tracking-[0.08em] text-fg-subtle" title={label}>
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          aria-hidden
          className={clsx("h-1.5 w-1.5 translate-y-[-2px] rounded-full", dot)}
        />
        <span
          className={clsx(
            "font-mono text-2xl tabular-nums",
            value === 0 ? "text-fg-disabled" : "text-fg",
          )}
        >
          {value}
        </span>
        <span className="font-mono text-[10px] text-fg-subtle">/24h</span>
      </div>
    </div>
  );
}

// =========================================================================
// reusable section
// =========================================================================

interface EventsSectionProps {
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

function EventsSection({
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
}: EventsSectionProps) {
  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>
          {title}
          {events.length > 0 && (
            <span className="ml-2 normal-case tracking-normal text-fg-subtle">
              · {events.length}
            </span>
          )}
        </SectionLabel>
        {subtitle && (
          <span className="text-[11px] text-fg-subtle">{subtitle}</span>
        )}
      </div>
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
    </section>
  );
}

// =========================================================================
// posture findings section — links to /aws-posture for the full list
// =========================================================================

function PostureFindingsSection({ events }: { events: EventEnvelope[] }) {
  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between">
        <SectionLabel>
          posture findings · new
          {events.length > 0 && (
            <span className="ml-2 normal-case tracking-normal text-fg-subtle">
              · {events.length}
            </span>
          )}
        </SectionLabel>
        <Link
          href="/aws-posture"
          className="text-[11px] text-fg-subtle hover:text-fg"
        >
          full posture →
        </Link>
      </div>
      <DataPanel className="overflow-hidden">
        {events.length === 0 ? (
          <EmptyState tone="ok">
            No new posture findings in the recent window.
          </EmptyState>
        ) : (
          <IamPostureEventsTable rows={events.map(toIamPostureRow)} />
        )}
      </DataPanel>
    </section>
  );
}
