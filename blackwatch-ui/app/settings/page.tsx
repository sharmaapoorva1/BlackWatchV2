import Link from "next/link";
import { KeyRound } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { KeyValueRow } from "@/components/layout/KeyValueRow";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { PendingButton } from "@/components/ui/PendingButton";
import { FlashToast } from "@/components/ui/FlashToast";
import { TablePageSizeSetting } from "@/components/ui/TablePreferences";

import { changePasswordAction } from "./actions";

type SearchParams = { msg?: string };

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { msg } = await searchParams;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Account credentials + pointers to where the rest of the config lives."
      />

      {msg && <FlashToast message={msg} />}

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="preferences" title="Preferences" description="Stored in this browser only.">
          <DataPanel className="p-4" scrollX={false}>
            <TablePageSizeSetting />
          </DataPanel>
        </Section>

        {/* Account credentials: the one thing on this page that writes to the DB. */}
        <Section id="account" title="Account" description="Sessions time out after 30 minutes of inactivity. Changing your password does not end this session.">
          <DataPanel className="p-4" scrollX={false}>
            <div className="mb-4 flex items-center gap-2">
              <KeyRound size={13} className="text-signal" aria-hidden />
              <span className="text-sm text-fg">Change password</span>
            </div>
            <form action={changePasswordAction} className="grid max-w-md gap-3" autoComplete="off">
              <Field label="Current password">
                <Input name="current_password" type="password" autoComplete="current-password" required className="w-full" />
              </Field>
              <Field label="New password" hint="At least 8 characters.">
                <Input name="new_password" type="password" autoComplete="new-password" required minLength={8} className="w-full" />
              </Field>
              <Field label="Confirm new password">
                <Input name="confirm_password" type="password" autoComplete="new-password" required minLength={8} className="w-full" />
              </Field>
              <div className="pt-1">
                <PendingButton size="sm" variant="primary" pendingLabel="Saving…">
                  Update password
                </PendingButton>
              </div>
            </form>
          </DataPanel>
        </Section>

        <Section id="reference" title="Where things live" description="These are configured outside the UI. This page only points to them.">
          <DataPanel>
            <dl>
              <KeyValueRow label="Connectors">
                <Link href="/connectors" className="text-signal hover:underline">
                  /connectors
                </Link>
              </KeyValueRow>
              <KeyValueRow label="Rules">
                <Link href="/rules" className="text-signal hover:underline">
                  /rules
                </Link>
                <span className="ml-2 text-fg-subtle">
                  · YAML in <code className="text-fg">rules/</code>, restart to reload
                </span>
              </KeyValueRow>
              <KeyValueRow label="Notifications">
                <code className="text-fg">notifications.yaml</code> in the repo root
              </KeyValueRow>
              <KeyValueRow label="Ingest tokens">
                <code className="text-fg">BLACKWATCH_TOKENS</code> env var on the FastAPI service
              </KeyValueRow>
              <KeyValueRow label="AWS credentials">
                Mounted <code className="text-fg">~/.aws</code> directory · profile names are referenced from each connector
              </KeyValueRow>
              <KeyValueRow label="Database">
                Postgres in the <code className="text-fg">db</code> compose service · migrations in <code className="text-fg">blackwatch/sql/</code>
              </KeyValueRow>
            </dl>
          </DataPanel>
          <Subsection id="operator-notes" title="Operator notes" defaultOpen={false}>
            <DataPanel className="p-4 text-xs text-fg-muted" scrollX={false}>
              <p>
                BlackWatch keeps secrets out of the database by design. References to env vars and mounted files only. See{" "}
                <code className="text-fg">docs/ui-design.md</code>.
              </p>
              <p className="mt-2">
                To change an ingest token, edit <code className="text-fg">docker-compose.yml</code> and run{" "}
                <code className="text-fg">docker compose up -d app</code>. Agents must be re-configured with the new token afterwards.
              </p>
            </DataPanel>
          </Subsection>
        </Section>
      </div>
    </>
  );
}
