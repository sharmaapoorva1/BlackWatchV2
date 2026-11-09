import { notFound } from "next/navigation";

import { fetchPostureFinding } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { SeverityBadge } from "@/components/domain/SeverityBadge";
import { CopyButton } from "@/components/ui/CopyButton";

export const metadata = { title: "Posture finding" };

export default async function PostureFindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const finding = await fetchPostureFinding(id);
  if (!finding) notFound();

  const evidenceJson = JSON.stringify(finding.evidence ?? {}, null, 2);
  const evidenceEntries = Object.entries(finding.evidence ?? {});

  return (
    <>
      <PageHeader
        title={finding.finding_type}
        subtitle={
          <span className="inline-flex max-w-full items-center gap-1">
            <code className="break-all">{finding.resource_id}</code>
            <CopyButton value={finding.resource_id} label="Copy resource ID" />
          </span>
        }
        breadcrumbs={[{ label: "AWS posture", href: "/aws-posture" }, { label: finding.finding_type }]}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="summary" title="Summary" description="What was found, where, and when.">
          <AutoGrid min="11rem">
            <MetaCell label="Severity">
              <SeverityBadge severity={finding.severity} />
            </MetaCell>
            <MetaCell label="Resource type">
              <span className="font-mono text-xs text-fg">{finding.resource_type}</span>
            </MetaCell>
            <MetaCell label="Region">
              <span className="font-mono text-xs text-fg">{finding.region ?? "—"}</span>
            </MetaCell>
            <MetaCell label="Account">
              <span className="font-mono text-xs text-fg">{finding.account ?? "—"}</span>
            </MetaCell>
            <MetaCell label="First seen">
              <TimestampCell value={finding.first_seen} />
            </MetaCell>
            <MetaCell label="Last seen">
              <TimestampCell value={finding.last_seen} />
            </MetaCell>
          </AutoGrid>
        </Section>

        <Section id="evidence" title="Evidence" description="The settings that triggered this finding.">
          {evidenceEntries.length > 0 && (
            <DataPanel>
              <dl className="divide-y divide-line-soft">
                {evidenceEntries.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-4 px-4 py-2.5">
                    <dt className="font-mono text-xs text-fg-muted">{key}</dt>
                    <dd className="col-span-2 break-all font-mono text-xs text-fg">{formatEvidenceValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </DataPanel>
          )}
          <Subsection id="evidence-raw" title="Raw evidence" summary="as stored, JSON" defaultOpen={evidenceEntries.length === 0}>
            <DataPanel className="overflow-auto p-4">
              <pre className="max-w-full overflow-auto break-words whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">{evidenceJson}</pre>
            </DataPanel>
          </Subsection>
        </Section>
      </div>
    </>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DataPanel className="p-4">
      <div className="text-xs text-fg-subtle">{label}</div>
      <div className="mt-2">{children}</div>
    </DataPanel>
  );
}

function formatEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
