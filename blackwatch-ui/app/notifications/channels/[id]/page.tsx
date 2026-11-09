import { notFound } from "next/navigation";

import { fetchNotificationChannel } from "@/lib/api";
import type { ChannelType } from "@/lib/types";
import { CHANNEL_TYPES } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { DataPanel } from "@/components/layout/DataPanel";
import { ChannelForm } from "@/components/domain/notifications/ChannelForm";

export const metadata = { title: "Edit channel" };

export default async function EditChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await fetchNotificationChannel(id);
  if (!channel) notFound();
  const knownType = (CHANNEL_TYPES as string[]).includes(channel.type)
    ? (channel.type as ChannelType)
    : null;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Notifications", href: "/notifications" }, { label: channel.name }]} title={`Edit · ${channel.name}`} subtitle={channel.id} />

      <Section id="settings" title="Channel settings" description="Changes apply to the next notification sent.">
      <DataPanel className="overflow-hidden">
        {knownType ? (
          <ChannelForm type={knownType} existing={channel} />
        ) : (
          <div className="p-4 text-xs text-fg-muted">
            Unknown channel type: <code className="text-fg">{channel.type}</code>
            <pre className="mt-2 overflow-auto bg-surface-2 p-3 text-xs">
              {JSON.stringify(channel.config, null, 2)}
            </pre>
          </div>
        )}
      </DataPanel>
      </Section>
    </>
  );
}
