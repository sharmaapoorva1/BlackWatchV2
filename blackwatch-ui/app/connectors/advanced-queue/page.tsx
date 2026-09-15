import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchConnectorOperations } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { AdvancedQueueView } from "@/components/domain/connectors/AdvancedQueueView";

export default async function AdvancedQueuePage() {
  let data: Awaited<ReturnType<typeof fetchConnectorOperations>> = {
    operations: [], active_operations: 0, max_concurrent_operations: 3, generated_at: new Date().toISOString(),
  };
  try { data = await fetchConnectorOperations(); } catch { /* client view retries */ }
  return <>
    <PageHeader title="Advanced Queue" subtitle="Live connector admission, SQS ingestion progress, and operation history" actions={<Button asChild size="sm" variant="secondary"><Link href="/connectors"><ArrowLeft size={14} /> Connectors</Link></Button>} />
    <AdvancedQueueView initial={data.operations} />
  </>;
}
