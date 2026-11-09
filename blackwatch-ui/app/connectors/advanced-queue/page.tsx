import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchConnectorOperations } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { AdvancedQueueView } from "@/components/domain/connectors/AdvancedQueueView";

export const metadata = { title: "Advanced queue" };

export default async function AdvancedQueuePage() {
  let data: Awaited<ReturnType<typeof fetchConnectorOperations>> = {
    operations: [], active_operations: 0, max_concurrent_operations: 3, generated_at: new Date().toISOString(),
  };
  try { data = await fetchConnectorOperations(); } catch { /* client view retries */ }
  return <>
    <PageHeader title="Advanced Queue" subtitle="Live connector admission, SQS ingestion progress, and operation history" actions={<Button asChild size="sm" variant="secondary"><Link href="/connectors"><ArrowLeft size={14} /> Connectors</Link></Button>} />
    <Section id="operations" title="Operations" description="Running and recent connector runs. Updates live."><AdvancedQueueView initial={data.operations} /></Section>
  </>;
}
