import { headers } from "next/headers";

import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { FilterBar } from "@/components/ui/FilterBar";
import {
  IpLookupResult,
  type IpApiResponse,
} from "@/components/domain/IpLookupResult";

// Uses ip-api.com via the local /api/tools/ip-lookup route handler so the
// same code path serves both the modal and the standalone page.
async function lookup(ip: string): Promise<IpApiResponse | null> {
  try {
    const base = process.env.BW_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const cookie = (await headers()).get("cookie");
    const res = await fetch(
      `${base}/api/tools/ip-lookup?ip=${encodeURIComponent(ip)}`,
      {
        cache: "no-store",
        headers: cookie ? { cookie } : undefined,
      },
    );
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as IpApiResponse | null;
      return j ?? {
        status: "fail",
        message: `HTTP ${res.status}`,
        providers: [],
        indicators: [],
        observedEvents: [],
        investigationStatus: "error",
      };
    }
    return (await res.json()) as IpApiResponse;
  } catch (exc) {
    return {
      status: "fail",
      message: String(exc),
      providers: [],
      indicators: [],
      observedEvents: [],
      investigationStatus: "error",
    };
  }
}

type SearchParams = { ip?: string };

export const metadata = { title: "IP lookup" };

export default async function IpLookupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ip } = await searchParams;
  const result = ip ? await lookup(ip.trim()) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "IP lookup" }]}
        title="IP lookup"
        subtitle="Fast geolocation plus optional threat sources, local feeds, related indicators, and matching BlackWatch events."
      />

      <div className="flex min-w-0 flex-col gap-10">
        <Section id="lookup" title="Lookup" description="Enter a value and run the lookup.">
      <FilterBar
        action="/tools/ip-lookup"
        label="Look up an IP address or hostname"
        clearHref={ip ? "/tools/ip-lookup" : undefined}
        applyLabel="Look up"
      >
        <Field label="IP address or hostname" compact className="w-full sm:w-80">
          <Input name="ip" mono defaultValue={ip ?? ""} placeholder="8.8.8.8  or  example.com" autoFocus />
        </Field>
      </FilterBar>
        </Section>
        {result && (
          <Section id="result" title="Result" description="Lookup results for the value above.">
            <IpLookupResult query={ip ?? ""} result={result} />
          </Section>
        )}
      </div>
    </>
  );
}
