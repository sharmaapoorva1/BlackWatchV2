import { fetchRules } from "@/lib/api";
import { buildRuleCards } from "@/lib/rules-view";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { AutoGrid, Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { MutedEventsTable } from "@/components/domain/MutedEventsTable";
import { StatCard } from "@/components/domain/OverviewParts";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { muteAction } from "./actions";
import { RulesTable } from "./RulesTable";

type SearchParams = { msg?: string };

export const metadata = { title: "Rules" };

/**
 * Rules, in the order an operator works:
 *   1. Rule health : enabled, disabled, suppress rules, muted filters
 *   2. Rule catalog: search, filter and tune every rule
 *   3. Muted events: filters that drop events at ingest
 */
export default async function RulesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams;
  const { count, rules, muted } = await fetchRules();
  const cards = buildRuleCards(rules, muted);

  return (
    <>
      <PageHeader title="Rules" subtitle={`${count} loaded · filter, toggle, and override severity below. YAML edits in rules/ need a restart.`} />

      {msg && (
        <div role="status" className="mb-4 rounded-md border border-line-soft bg-surface-1 px-3 py-2 text-xs text-fg-muted">
          {msg}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="health" title="Rule health" description="What is detecting, what is switched off, and what is being muted.">
          <AutoGrid min="15rem">
            {cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </AutoGrid>
        </Section>

        <Section id="catalog" title="Rule catalog" description="Search, filter, and adjust runtime rule behavior.">
          <DataPanel className="overflow-hidden">
            <RulesTable rules={rules} />
          </DataPanel>
        </Section>

        <Section id="muted" title="Muted event filters" description="Dropped at ingest, before events are stored.">
          <DataPanel className="overflow-hidden">
            {muted.length > 0 ? <MutedEventsTable muted={muted} /> : <EmptyState tone="ok">Nothing muted.</EmptyState>}
          </DataPanel>

          <Subsection id="muted-add" title="Mute an event" summary="leave filters empty to mute the whole action" defaultOpen={muted.length === 0}>
            <DataPanel className="space-y-4 p-4">
              <p className="text-sm text-fg-muted">
                Fill in filters to silence only a specific combination. For example, mute <code className="text-fg">rds.auth.failure</code> where{" "}
                <code className="text-fg">source_type=postgres</code>, <code className="text-fg">username=application_user</code>,{" "}
                <code className="text-fg">reason=no_pg_hba_entry</code> to kill the pg_hba backend-reject noise without hiding real application_user
                password failures. This stops events cluttering BlackWatch but does <strong>not</strong> reduce AWS cost. To cut cost, also drop the
                event from the EventBridge pattern in <code className="text-fg">deploy/iam/</code>.
              </p>
              <form action={muteAction} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <Field label="Action" hint="Required" compact>
                    <Input name="action" placeholder="rds.auth.failure" required />
                  </Field>
                  <Field label="Source type" compact>
                    <Input name="source_type" placeholder="optional" />
                  </Field>
                  <Field label="Username" compact>
                    <Input name="username" placeholder="optional" />
                  </Field>
                  <Field label="Reason" compact>
                    <Input name="reason" placeholder="optional" />
                  </Field>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field label="Note" hint="Why this is muted, and when to unmute" compact className="flex-1">
                    <Input name="note" placeholder="optional" />
                  </Field>
                  <Button type="submit" variant="primary" size="sm">
                    Mute
                  </Button>
                </div>
              </form>
            </DataPanel>
          </Subsection>
        </Section>
      </div>
    </>
  );
}
