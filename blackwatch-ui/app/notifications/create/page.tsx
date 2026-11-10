import Link from "next/link";
import { ArrowRight, Bell, GaugeCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";

// Landing chooser for the two mechanically-different notification types.
// Event-based routes match on existing event fields (module/severity);
// performance-based rules evaluate continuous host metrics against a
// threshold + window. Different mechanics → different forms; this page
// makes the choice explicit instead of pretending they're the same thing.
export const metadata = { title: "Create alert" };

export default function CreateAlertChooser() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Notifications", href: "/notifications" }, { label: "Create alert" }]}
        title="Create alert"
        subtitle="Pick the shape that fits — event-based for anything BW already emits, performance-based for host metric thresholds."
      />

      <Section id="shape" title="Alert type" description="Event-based and performance-based alerts work differently, so they have different forms.">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ChoiceCard
          href="/notifications/create/event"
          icon={<Bell size={18} strokeWidth={1.5} />}
          title="Event-based route"
          blurb="Fire when BW ingests an event matching a source + severity. Works for every module: auth, IAM, RDS, API Gateway, ECS probes, etc."
          examples={[
            "IAM: root-user activity → Slack #security",
            "API GW: auth burst → Slack + PagerDuty",
            "VPN: brute-force → Slack #ops",
          ]}
        />
        <ChoiceCard
          href="/notifications/perf-alerts/new"
          icon={<GaugeCircle size={18} strokeWidth={1.5} />}
          title="Performance-based rule"
          blurb="Fire when a host metric breaches a threshold for a configurable duration. Scope by instance or by tag. Fully customizable — metric, comparison, threshold, window, breach ratio."
          examples={[
            "CPU load > 80% for 15 min on any prod host",
            "Memory used > 90% for 5 min on i-08ba…",
            "Disk (worst mount) > 85% for 30 min on env=prod",
          ]}
        />
      </div>
      </Section>
    </div>
  );
}

function ChoiceCard({
  href,
  icon,
  title,
  blurb,
  examples,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  examples: string[];
}) {
  return (
    <Link href={href} className="group block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal">
      <div className="relative flex h-full flex-col rounded-md border border-line-soft bg-surface-1 transition-colors group-hover:border-signal group-focus-visible:border-signal">
        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center border border-signal/20 bg-signal/5">
              <span className="text-signal">{icon}</span>
            </div>
            <ArrowRight
              size={14}
              className="text-fg-subtle transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-signal"
            />
          </div>

          <h3 className="mt-4 text-sm font-semibold text-fg">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{blurb}</p>

          <div className="mt-auto pt-5">
            <div className="border-t border-line-soft pt-4">
              <span className="text-xs text-fg-subtle">
                Examples
              </span>
              <ul className="mt-2 space-y-1.5">
                {examples.map((e) => (
                  <li
                    key={e}
                    className="flex items-start gap-2 font-mono text-xs text-fg-subtle"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal/40" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
