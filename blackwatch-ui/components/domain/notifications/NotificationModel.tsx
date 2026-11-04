import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Step = { title: string; question: string; summary: string; href: string; cta: string };

// The one mental model for the whole area: an alert is "when something
// happens, send it to a place, worded a certain way". Each step shows the
// current state and links to where that step is configured, so a new operator
// never has to guess which of the screens does what.
export function NotificationModel({
  routeCount,
  channelCount,
  hasProfiles = true,
}: {
  routeCount: number;
  channelCount: number;
  hasProfiles?: boolean;
}) {
  const steps: Step[] = [
    {
      title: "When",
      question: "What should trigger an alert?",
      summary: routeCount === 0 ? "No alert routes yet" : `${routeCount} alert ${routeCount === 1 ? "route" : "routes"}`,
      href: "#routes",
      cta: "Alert routes",
    },
    {
      title: "Send to",
      question: "Where should it go?",
      summary: channelCount === 0 ? "No channels yet" : `${channelCount} ${channelCount === 1 ? "channel" : "channels"}`,
      href: "#channels",
      cta: "Channels",
    },
    {
      title: "Worded as",
      question: "What should the message say?",
      summary: hasProfiles ? "Per-alert message templates" : "Default wording",
      href: "/notifications/profiles",
      cta: "Message studio",
    },
  ];

  return (
    <ol aria-label="How notifications work" className="mb-6 grid gap-px border border-line bg-line md:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title} className="bg-surface-1">
          <Link
            href={step.href}
            className="group flex h-full min-h-20 flex-col justify-between gap-2 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70"
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-fg">
                <span aria-hidden="true" className="grid h-5 w-5 place-items-center border border-signal/60 font-mono text-xs text-signal">{index + 1}</span>
                {step.title}
              </span>
              <span className="mt-1 block text-xs text-fg-muted">{step.question}</span>
            </span>
            <span className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">{step.summary}</span>
              <span className="inline-flex items-center gap-1 text-signal group-hover:underline">
                {step.cta} <ArrowRight size={12} aria-hidden="true" />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
