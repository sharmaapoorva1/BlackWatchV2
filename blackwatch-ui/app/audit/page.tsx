import { apiFetch } from "@/lib/server-fetch";
import { AuditDataTable, type AuditEntry } from "@/components/domain/AuditDataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rows = await loadAudit(sp);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        subtitle="Append-only record of every mutation this BlackWatch instance received."
      />

      <form className="flex flex-wrap gap-2 text-sm" action="/audit" method="get">
        <Input
          type="text"
          name="actor"
          placeholder="actor"
          defaultValue={sp.actor ?? ""}
          className="w-auto"
        />
        <Input
          type="text"
          name="path"
          placeholder="path contains"
          defaultValue={sp.path ?? ""}
          className="w-auto"
        />
        <Input
          type="datetime-local"
          name="since"
          defaultValue={sp.since ?? ""}
          className="w-auto"
        />
        <Input
          type="number"
          name="limit"
          placeholder="limit"
          defaultValue={sp.limit ?? "200"}
          className="w-24"
        />
        <Button
          type="submit"
          variant="secondary" size="sm"
        >
          Filter
        </Button>
      </form>

      <AuditDataTable rows={rows} />
    </div>
  );
}
