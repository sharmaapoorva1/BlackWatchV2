
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import { DnsLookupResult } from "@/components/domain/DnsLookupResult";
import type { DnsLookupResponse } from "@/app/api/tools/dns-lookup/route";

// Uses Node's built-in dns/promises via our local /api/tools/dns-lookup route
// handler. Same-origin so this page can be SSR'd and shared with any future
// modal-based use.
async function lookup(host: string): Promise<DnsLookupResponse | null> {
  try {
    const base = process.env.BW_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(
      `${base}/api/tools/dns-lookup?host=${encodeURIComponent(host)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as DnsLookupResponse | null;
      return (
        j ?? {
          status: "fail",
          query: host,
          records: [],
          message: `HTTP ${res.status}`,
        }
      );
    }
    return (await res.json()) as DnsLookupResponse;
  } catch (exc) {
    return { status: "fail", query: host, records: [], message: String(exc) };
  }
}

type SearchParams = { host?: string };

export const metadata = { title: "DNS lookup" };

export default async function DnsLookupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { host } = await searchParams;
  const result = host ? await lookup(host.trim()) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "DNS lookup" }]}
        title="DNS lookup"
        subtitle="A, AAAA, MX, TXT, CNAME, NS, SOA — all in one pass. Resolved by the local Node resolver."
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="lookup" title="Lookup" description="Enter a value and run the lookup.">
      <FilterBar
        action="/tools/dns-lookup"
        label="Look up DNS records"
        clearHref={host ? "/tools/dns-lookup" : undefined}
        applyLabel="Look up"
      >
        <Field label="Hostname" compact className="w-full sm:w-80">
          <Input name="host" mono defaultValue={host ?? ""} placeholder="example.com" autoFocus />
        </Field>
      </FilterBar>
        </Section>
        {result && (
          <Section id="result" title="Result" description="Lookup results for the value above.">
            <DnsLookupResult result={result} />
          </Section>
        )}
      </div>
    </>
  );
}
