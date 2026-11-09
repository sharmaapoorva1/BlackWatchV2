import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { fetchNotificationProfiles } from "@/lib/api";
import type { NotificationProfile, NotificationProfileModule } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataPanel } from "@/components/layout/DataPanel";
import { StatusPill } from "@/components/ui/StatusPill";
import { Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";

export const metadata = { title: "Message studio" };

export default async function NotificationProfilesPage() {
  const data = await fetchNotificationProfiles();
  const byModule = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const configured = data.profiles.filter((profile) => profile.source === "saved").length;
  const enabled = data.profiles.filter((profile) => profile.enabled).length;

  return (
    <>
      <div className="mb-4">
        <Link href="/notifications" className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
          <ArrowLeft size={12} /> back to notifications
        </Link>
      </div>

      <PageHeader
        title="Notification Studio"
        subtitle={`${configured} customized · ${enabled} enabled · choose a module, then edit an alert in plain language`}
      />

      <Section
        id="modules"
        title="Alert types by module"
        description="Configure what a person should understand when an alert arrives: wording, urgency, delivery, context, impact and next steps. Advanced templates are optional."
      >
        {data.catalog.map((module) => (
          <ModuleProfilePanel
            key={module.key}
            module={module}
            profiles={module.events.map((event) => byModule.get(`profile:${module.key}:${event.key}`)).filter(Boolean) as NotificationProfile[]}
          />
        ))}
      </Section>
    </>
  );
}

function ModuleProfilePanel({
  module,
  profiles,
}: {
  module: NotificationProfileModule;
  profiles: NotificationProfile[];
}) {
  const profileByKind = new Map(profiles.map((profile) => [profile.event_kind, profile]));
  const enabled = module.events.filter((event) => profileByKind.get(event.key)?.enabled).length;
  return (
    <Subsection
      id={`module-${module.key}`}
      title={module.label}
      count={module.events.length}
      summary={`${enabled} enabled · ${module.description}`}
      defaultOpen={enabled > 0}
    >
      <DataPanel className="overflow-hidden">
        <div className="divide-y divide-line-soft">
          {module.events.map((event) => {
            const profile = profileByKind.get(event.key);
            return (
              <Link
                key={event.key}
                href={`/notifications/profiles/${encodeURIComponent(profile?.id ?? `profile:${module.key}:${event.key}`)}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-fg">{event.label}</span>
                    <StatusPill
                      severity={profile?.enabled ? "resolved" : profile?.source === "saved" ? "high" : "neutral"}
                      label={profile?.enabled ? "enabled" : profile?.source === "saved" ? "saved · off" : "not configured"}
                    />
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-fg-subtle">{event.key}</p>
                </div>
                <ChevronRight size={14} className="shrink-0 text-fg-subtle" />
              </Link>
            );
          })}
        </div>
      </DataPanel>
    </Subsection>
  );
}
