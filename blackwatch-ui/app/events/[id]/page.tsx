import { notFound } from "next/navigation";

import { fetchEvent } from "@/lib/api";
import { eventTargetLabel } from "@/lib/event-summary";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { TimestampCell } from "@/components/domain/TimestampCell";
import { SeverityBadge } from "@/components/domain/SeverityBadge";
import { IntelBadge, type IntelData } from "@/components/domain/IntelBadge";
import { CopyButton } from "@/components/ui/CopyButton";

export const metadata = { title: "Event" };

/**
 * One event, in the order an investigator reads it:
 *   1. Summary  : severity, time, module, who, what, outcome, rules that matched
 *   2. Intel    : threat-intelligence context, when present
 *   3. Payload  : the normalized envelope, then the raw source record
 * h1 page, h2 section, h3 payload block.
 */
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) notFound();

  // Strip the raw payload out for the envelope view so it can be inspected
  // independently: they are often large and noisy.
  const { raw, ...envelopeForDisplay } = (event ?? {}) as Record<string, unknown>;
  const envelopeJson = JSON.stringify(envelopeForDisplay, null, 2);
  const intel = (event as { extra?: { intel?: IntelData } })?.extra?.intel ?? null;
  const rawJson = raw === undefined ? null : JSON.stringify(raw, null, 2);
  const target = eventTargetLabel(event);
  const matches = event.rule_matches ?? [];

  return (
    <>
      <PageHeader
        title={event.action}
        subtitle={
          <span className="inline-flex max-w-full items-center gap-1">
            <code className="break-all">{event.event_id}</code>
            <CopyButton value={event.event_id} label="Copy event ID" />
          </span>
        }
        breadcrumbs={[{ label: "Events", href: "/events" }, { label: event.action }]}
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="summary" title="Summary" description="What happened, to what, and who did it.">
          <AutoGrid min="12rem">
            <Cell label="Severity">
              <SeverityBadge severity={(event.severity as string) ?? null} />
            </Cell>
            <Cell label="Time">
              <TimestampCell value={event.event_time} />
            </Cell>
            <Cell label="Module">
              <Mono>{event.source?.module ?? "—"}</Mono>
            </Cell>
            <Cell label="Actor">
              <Mono>{event.actor?.principal ?? "—"}</Mono>
            </Cell>
            <Cell label="Target">
              <Mono>{target || "—"}</Mono>
            </Cell>
            <Cell label="Outcome">
              <Mono>{event.outcome ?? "—"}</Mono>
            </Cell>
            {matches.length > 0 && (
              <Cell label="Rules matched">
                <div className="flex flex-wrap gap-1.5">
                  {matches.map((rule) => (
                    <code key={rule} className="rounded border border-line-soft px-1.5 py-0.5 text-xs text-fg">
                      {rule}
                    </code>
                  ))}
                </div>
              </Cell>
            )}
          </AutoGrid>
        </Section>

        {intel && (
          <Section id="intel" title="Threat intelligence" description="What threat feeds say about this event's addresses.">
            <IntelBadge intel={intel} />
          </Section>
        )}

        <Section id="payload" title="Payload" description="The normalized event, and the source record it came from.">
          <Subsection id="payload-envelope" title="Envelope" summary="normalized, JSON">
            <JsonPanel json={envelopeJson} />
          </Subsection>
          {rawJson && (
            <Subsection id="payload-raw" title="Raw record" summary="as received, JSON" defaultOpen={false}>
              <JsonPanel json={rawJson} />
            </Subsection>
          )}
        </Section>
      </div>
    </>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DataPanel className="p-4">
      <div className="text-xs text-fg-subtle">{label}</div>
      <div className="mt-2">{children}</div>
    </DataPanel>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="break-all font-mono text-xs text-fg">{children}</span>;
}

function JsonPanel({ json }: { json: string }) {
  return (
    <DataPanel className="overflow-auto p-4">
      <pre className="max-w-full overflow-auto break-words whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">{json}</pre>
    </DataPanel>
  );
}
