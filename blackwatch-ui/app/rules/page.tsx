import { fetchRules } from "@/lib/api";
import type { MutedEvent } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { muteAction, unmuteAction } from "./actions";
import { RulesTable } from "./RulesTable";
import { Alert, Box, Button as MuiButton, Paper, Stack, TextField, Typography } from "@mui/material";

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

      <Stack spacing={1.5} component="section">
        <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ letterSpacing: "0.04em" }}>Rule catalog</Typography>
            <Typography variant="caption" color="text.secondary">
              Search, filter, and adjust runtime rule behavior.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">{count} loaded</Typography>
        </Box>
        <DataPanel className="overflow-hidden">
          <RulesTable rules={rules} />
        </DataPanel>
      </Stack>

      <Stack spacing={1.5} component="section" sx={{ mt: 4 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ letterSpacing: "0.04em" }}>Muted event filters</Typography>
          <Typography variant="caption" color="text.secondary">Dropped at ingest before events are stored.</Typography>
        </Box>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
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
          </Typography>

          {muted.length > 0 ? (
            <MutedTable muted={muted} />
          ) : (
            <Typography sx={{ mt: 2 }} variant="body2" color="text.secondary">Nothing muted.</Typography>
          )}

          <form
            action={muteAction}
            className="mt-4 space-y-2 border-t border-line-soft pt-4"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <TextField
                name="action"
                placeholder="action (required)"
                required
                aria-label="action"
                size="small"
              />
              <TextField
                name="source_type"
                placeholder="source_type (optional)"
                aria-label="source_type"
                size="small"
              />
              <TextField
                name="username"
                placeholder="username (optional)"
                aria-label="username"
                size="small"
              />
              <TextField
                name="reason"
                placeholder="reason (optional)"
                aria-label="reason"
                size="small"
              />
            </div>
            <div className="flex items-center gap-2">
              <TextField
                name="note"
                placeholder="note — why this is muted, unblock condition (optional)"
                aria-label="note"
                className="flex-1"
                size="small"
              />
              <MuiButton type="submit" variant="contained" size="small">
                Mute
              </MuiButton>
            </div>
          </form>
        </Paper>
      </Stack>
    </>
  );
}

// --- table renderers ------------------------------------------------------

function MutedTable({ muted }: { muted: MutedEvent[] }) {
  return (
    <div className="mt-4 border border-line-soft">
      <Table>
        <thead>
          <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
            <th className="px-4 py-2 text-left font-normal">Action</th>
            <th className="px-4 py-2 text-left font-normal">Source type</th>
            <th className="px-4 py-2 text-left font-normal">Username</th>
            <th className="px-4 py-2 text-left font-normal">Reason</th>
            <th className="px-4 py-2 text-left font-normal">Note</th>
            <th className="w-32 px-4 py-2 text-right font-normal" />
          </tr>
        </thead>
        <tbody>
          {muted.map((m) => (
            <tr
              key={m.id}
              className="border-b border-line-soft last:border-0 hover:bg-surface-2"
            >
              <td className="px-4 py-2 font-mono text-xs text-fg">{m.action}</td>
              <MutedFilterCell value={m.source_type} />
              <MutedFilterCell value={m.username} />
              <MutedFilterCell value={m.reason} />
              <td className="px-4 py-2 text-xs text-fg-muted">
                {m.note ? m.note : <span className="text-fg-disabled">—</span>}
              </td>
              <td className="px-4 py-2 text-right">
                <form action={unmuteAction} className="inline">
                  <input type="hidden" name="id" value={m.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Unmute
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** Renders a single filter column value — italic "(any)" when null so
 *  the operator can distinguish "matches everything" from a specific
 *  literal empty string (which the API rejects anyway). */
function MutedFilterCell({ value }: { value: string | null }) {
  return (
    <td className="px-4 py-2 font-mono text-xs text-fg-muted">
      {value === null ? (
        <span className="italic text-fg-disabled">any</span>
      ) : (
        value
      )}
    </td>
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
