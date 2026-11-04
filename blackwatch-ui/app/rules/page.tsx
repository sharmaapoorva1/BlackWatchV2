import { fetchRules } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { MutedEventsTable } from "@/components/domain/MutedEventsTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { muteAction } from "./actions";
import { RulesTable } from "./RulesTable";

type SearchParams = { msg?: string };

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { msg } = await searchParams;
  const { count, rules, muted } = await fetchRules();

  return (
    <>
      <PageHeader
        title="Rules"
        subtitle={`${count} loaded · filter, toggle, and override severity below. YAML edits in rules/ need a restart.`}
      />

      {msg && <MessageBar message={msg} />}

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4"><div>
            <h2 className="text-sm tracking-[0.04em]">Rule catalog</h2>
            <p className="text-[11px] text-muted">
              Search, filter, and adjust runtime rule behavior.
            </p>
          </div><span className="text-[11px] text-muted">{count} loaded</span></div>
        <DataPanel className="overflow-hidden">
          <RulesTable rules={rules} />
        </DataPanel>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <div><h2 className="text-sm tracking-[0.04em]">Muted event filters</h2>
          <p className="text-[11px] text-muted">Dropped at ingest before events are stored.</p></div>
        <div className="border border-line p-4 text-sm text-muted">
          <p>
            Muted events are discarded before storage. Leave the filter
            fields empty to mute an entire action; fill them in to silence
            only a specific combo — e.g. mute{" "}
            <code className="text-fg">rds.auth.failure</code> where{" "}
            <code className="text-fg">source_type=postgres</code>,{" "}
            <code className="text-fg">username=application_user</code>,{" "}
            <code className="text-fg">reason=no_pg_hba_entry</code> to kill
            the pg_hba backend-reject noise without hiding real
            application_user password failures. Note: this stops events
            cluttering BlackWatch but does <strong>not</strong> reduce AWS
            cost — to cut cost, also drop the event from the EventBridge
            pattern in <code className="text-fg">deploy/iam/</code>.
          </p>

          {muted.length > 0 ? (
            <div className="mt-4">
              <MutedEventsTable muted={muted} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Nothing muted.</p>
          )}

          <form
            action={muteAction}
            className="mt-4 space-y-2 border-t border-line-soft pt-4"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <Input
                name="action"
                placeholder="action (required)"
                required
                aria-label="action"
              />
              <Input
                name="source_type"
                placeholder="source_type (optional)"
                aria-label="source_type"
              />
              <Input
                name="username"
                placeholder="username (optional)"
                aria-label="username"
              />
              <Input
                name="reason"
                placeholder="reason (optional)"
                aria-label="reason"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                name="note"
                placeholder="note — why this is muted, unblock condition (optional)"
                aria-label="note"
                className="flex-1"
              />
              <Button type="submit" variant="primary" size="sm">
                Mute
              </Button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

// --- presentational pieces ------------------------------------------------

function MessageBar({ message }: { message: string }) {
  return (
    <div className="mb-4 border-l-2 border-signal bg-surface-1 px-3 py-2 text-xs text-fg-muted">
      <span className="text-signal">·</span> {message}
    </div>
  );
}
