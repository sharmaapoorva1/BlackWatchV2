import { AlertTriangle, Check, Save, Send } from "lucide-react";
import { notFound } from "next/navigation";

import { fetchNotificationChannels, fetchNotificationProfiles } from "@/lib/api";
import type { NotificationProfile, NotificationProfileContent } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Subsection } from "@/components/layout/Subsection";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DataPanel } from "@/components/layout/DataPanel";
import { FlashToast } from "@/components/ui/FlashToast";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ProfilePreview } from "@/components/domain/notifications/ProfilePreview";
import { saveNotificationProfileAction, testNotificationProfileAction } from "../../profile-actions";

type SearchParams = { msg?: string };

const SEVERITIES = ["informational", "low", "medium", "high", "critical"] as const;
const CONTENT_FIELDS: Array<{
  key: keyof NotificationProfileContent;
  label: string;
  hint: string;
  multiline?: boolean;
}> = [
  { key: "title", label: "Message title", hint: "A short sentence people can scan quickly." },
  { key: "what_happened", label: "What happened", hint: "Explain the signal in plain language.", multiline: true },
  { key: "facts", label: "Key facts", hint: "Show the values someone needs to decide quickly, such as user, source, target, and time.", multiline: true },
  { key: "decision", label: "Decision", hint: "State what the receiver should determine first.", multiline: true },
  { key: "next_steps", label: "Next steps", hint: "Give the first one or two actions in the order the receiver should take.", multiline: true },
  { key: "why_it_matters", label: "Why it matters", hint: "Give the receiver enough context to decide what to do.", multiline: true },
  { key: "evidence", label: "Evidence", hint: "Point to the observed value, actor, target, or event.", multiline: true },
  { key: "monitoring_method", label: "How we monitor it", hint: "Name the check, collector, or signal that produced it.", multiline: true },
  { key: "impact", label: "Possible impact", hint: "Describe the customer or technical consequence.", multiline: true },
  { key: "recovery", label: "Recovery", hint: "Explain how recovery will be recognized.", multiline: true },
  { key: "runbook_url", label: "Runbook link", hint: "Optional URL to the team’s response guide." },
];

export const metadata = { title: "Message profile" };

export default async function NotificationProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, { msg }, data, channelsData] = await Promise.all([
    params,
    searchParams,
    fetchNotificationProfiles(),
    fetchNotificationChannels(),
  ]);
  const profile = data.profiles.find((item) => item.id === decodeURIComponent(id));
  if (!profile) notFound();
  const eventSpec = data.catalog
    .find((module) => module.key === profile.module)
    ?.events.find((event) => event.key === profile.event_kind);
  const availableFields = eventSpec?.available_fields ?? ["{target_name}", "{severity}", "{evidence}", "{monitoring_method}", "{impact}"];
  const contentFields = new Set(eventSpec?.content_fields ?? profile.content_fields ?? CONTENT_FIELDS.map((field) => field.key));

  return (
    <>
      {msg && <FlashToast message={msg} />}
      <PageHeader
        breadcrumbs={[{ label: "Notification Studio", href: "/notifications/profiles" }, { label: profile.label }]}
        title={profile.label}
        subtitle={
          <>
            <code className="font-mono text-xs text-signal">
              {profile.module} · {profile.event_kind}
            </code>
            <span className="mt-1 block max-w-2xl">{profile.description}</span>
          </>
        }
        actions={<StatusNote profile={profile} />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <form action={saveNotificationProfileAction} data-notification-profile className="space-y-6">
          <input type="hidden" name="id" value={profile.id} />
          <input type="hidden" name="module" value={profile.module} />
          <input type="hidden" name="event_kind" value={profile.event_kind} />

          <Section id="delivery" title="When this alert is sent" description="Turn this alert on, choose urgency, and decide where it should arrive.">
          <DataPanel className="p-5" scrollX={false}>
            <div className="flex items-center justify-between rounded-md border border-line-soft bg-surface-2 px-3 py-3">
              <div>
                <p className="text-sm text-fg">Enable this alert</p>
                <p className="mt-0.5 text-xs text-fg-subtle">BlackWatch will route matching events through the shared delivery worker.</p>
              </div>
              <Checkbox name="enabled" defaultChecked={profile.enabled} aria-label="Enable this alert" />
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <ChoiceGroup title="Urgency" hint="Only selected severities will use this profile.">
                <div className="flex flex-wrap gap-1.5">
                  {SEVERITIES.map((severity) => (
                    <label key={severity} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-1 px-2.5 py-2 text-xs text-fg-muted transition-colors hover:bg-surface-2 has-[:checked]:border-signal has-[:checked]:bg-signal/10 has-[:checked]:text-fg">
                      <Checkbox name="severity" value={severity} defaultChecked={profile.severities.includes(severity)} />
                      {severity}
                    </label>
                  ))}
                </div>
              </ChoiceGroup>
              <ChoiceGroup title="Send to" hint="Pick one or more configured channels.">
                {channelsData.channels.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {channelsData.channels.map((channel) => (
                      <label key={channel.name} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-1 px-2.5 py-2 text-xs text-fg-muted transition-colors hover:bg-surface-2 has-[:checked]:border-signal has-[:checked]:bg-signal/10 has-[:checked]:text-fg">
                        <Checkbox name="channel" value={channel.name} defaultChecked={profile.channels.includes(channel.name)} />
                        <span>{channel.name}</span>
                        <span className="font-mono text-xs text-fg-subtle">{channel.type}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="border border-sev-medium/30 bg-sev-medium/10 px-3 py-2 text-xs text-sev-medium">Add a notification channel before enabling this alert.</p>
                )}
              </ChoiceGroup>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Throttle repeated alerts" hint="Seconds between repeats." compact>
                <Input name="throttle_seconds" type="number" min={0} step={60} defaultValue={profile.throttle_seconds} />
              </Field>
              <Field label="Digest window" hint="Seconds. 0 turns digests off." compact>
                <Input name="digest_window_seconds" type="number" min={0} step={60} defaultValue={profile.digest_window_seconds} />
              </Field>
            </div>
          </DataPanel>
          </Section>

          <Section id="message" title="What people should understand" description="Start with the facts and next action. Optional context can stay short; advanced templates are available below.">
          <DataPanel className="p-5" scrollX={false}>
            <div className="space-y-4">
              {CONTENT_FIELDS.filter((field) => contentFields.has(field.key)).map((field) => (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  {field.multiline ? (
                    <Textarea name={field.key} defaultValue={profile.content[field.key]} rows={3} className="text-sm leading-5" />
                  ) : (
                    <Input name={field.key} defaultValue={profile.content[field.key]} />
                  )}
                </Field>
              ))}
            </div>
            <p className="mt-4 border-l-2 border-signal/40 pl-3 font-mono text-xs leading-5 text-fg-subtle">
              Available placeholders: {availableFields.join(" · ")}
            </p>
            <p className="mt-3 text-xs text-fg-subtle">
              Contract status: <span className="text-fg-muted">{eventSpec?.content_status ?? profile.content_status}</span>. Preview and delivery use the same event-specific contract.
            </p>
          </DataPanel>
          <Subsection id="advanced" title="Advanced template" summary="optional" defaultOpen={Boolean(profile.advanced_template)}>
            <DataPanel className="p-5" scrollX={false}>
              <p className="mb-3 text-xs leading-5 text-fg-subtle">Leave this blank to use the guided fields. Advanced templates use the existing Jinja event context and are intended for experienced operators.</p>
              <Textarea name="advanced_template" defaultValue={profile.advanced_template ?? ""} rows={8} className="font-mono text-xs leading-5" placeholder="{{ event.action }} on {{ event.target.name }}" />
            </DataPanel>
          </Subsection>
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-fg-subtle">Saving updates the alert profile and its compiled delivery rule.</p>
            <Button type="submit" variant="primary"><Save size={13} /> Save profile</Button>
          </div>
        </form>

        <aside className="space-y-6 xl:sticky xl:top-5 xl:self-start">
          <ProfilePreview profile={profile} channels={channelsData.channels} />
          <Section id="test" title="Send a test" description="Uses the saved version and sends a sample through every selected channel.">
          <DataPanel className="p-5" scrollX={false}>
            <form action={testNotificationProfileAction}>
              <input type="hidden" name="id" value={profile.id} />
              <Button type="submit" size="sm" disabled={!profile.channels.length}><Send size={13} /> Send test notification</Button>
              {!profile.channels.length && <p className="mt-3 text-xs text-fg-subtle">Save at least one channel first.</p>}
            </form>
          </DataPanel>
          </Section>
        </aside>
      </div>
    </>
  );
}

function ChoiceGroup({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <div><p className="text-xs text-fg-muted">{title}</p><p className="mt-1 text-xs text-fg-subtle">{hint}</p><div className="mt-2">{children}</div></div>;
}

function StatusNote({ profile }: { profile: NotificationProfile }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-line-soft bg-surface-1 px-3 py-2 text-xs text-fg-muted">
      {profile.enabled ? <Check size={13} className="text-sev-resolved" /> : <AlertTriangle size={13} className="text-sev-medium" />}
      {profile.enabled ? "enabled" : profile.source === "default" ? "not configured" : "saved but off"}
    </div>
  );
}
