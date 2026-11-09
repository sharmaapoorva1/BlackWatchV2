import { apiFetch } from "@/lib/server-fetch";
import { AuditDataTable, type AuditEntry } from "@/components/domain/AuditDataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Input } from "@/components/ui/Input";
import { ActiveFilters } from "@/components/ui/ActiveFilters";
import { Field } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";

interface SearchParams {
  actor?: string;
  path?: string;
  since?: string;
  limit?: string;
}

async function loadAudit(sp: SearchParams): Promise<AuditEntry[]> {
  const qs = new URLSearchParams();
  if (sp.actor) qs.set("actor", sp.actor);
  if (sp.path) qs.set("path", sp.path);
  if (sp.since) qs.set("since", sp.since);
  qs.set("limit", sp.limit ?? "200");
  const res = await apiFetch(`/api/audit?${qs.toString()}`);
  if (res.status === 403) return [];
  if (!res.ok) throw new Error(`audit fetch failed: ${res.status}`);
  const j = (await res.json()) as { rows: AuditEntry[] };
  return j.rows ?? [];
}

export const metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rows = await loadAudit(sp);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only record of every mutation this BlackWatch instance received."
      />

      <Section id="entries" title="Entries" description="Newest first. Filter by who, which path, or since when.">
      <FilterBar action="/audit" label="Filter audit log" clearHref="/audit">
        <Field label="Actor" compact className="w-full sm:w-44">
          <Input type="text" name="actor" defaultValue={sp.actor ?? ""} placeholder="username" />
        </Field>
        <Field label="Path contains" compact className="w-full sm:w-56">
          <Input type="text" name="path" defaultValue={sp.path ?? ""} placeholder="/api/rules" />
        </Field>
        <Field label="Since" compact className="w-full sm:w-52">
          <Input type="datetime-local" name="since" defaultValue={sp.since ?? ""} />
        </Field>
        <Field label="Limit" compact className="w-full sm:w-24">
          <Input type="number" name="limit" min={1} max={1000} defaultValue={sp.limit ?? "200"} />
        </Field>
      </FilterBar>
      <ActiveFilters
        basePath="/audit"
        params={{ actor: sp.actor, path: sp.path, since: sp.since }}
        labels={{ actor: "Actor", path: "Path", since: "Since" }}
      />

      <AuditDataTable rows={rows} />
      </Section>
    </>
  );
}
