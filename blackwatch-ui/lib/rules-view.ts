import type { MutedEvent, Rule } from "./types";
import type { HealthCard } from "./overview";

export function ruleCounts(rules: Pick<Rule, "enabled" | "rule_action" | "severity">[]) {
  const enabled = rules.filter((r) => r.enabled);
  return {
    total: rules.length,
    enabled: enabled.length,
    disabled: rules.length - enabled.length,
    suppress: enabled.filter((r) => r.rule_action === "suppress").length,
    // Enabled alert rules at high or critical: the ones that page someone.
    serious: enabled.filter((r) => r.rule_action === "alert" && (r.severity === "high" || r.severity === "critical")).length,
  };
}

/** A muted filter with no source, username or reason mutes the whole action. */
export function isBroadMute(m: Pick<MutedEvent, "source_type" | "username" | "reason">): boolean {
  return !m.source_type && !m.username && !m.reason;
}

export function buildRuleCards(rules: Pick<Rule, "enabled" | "rule_action" | "severity">[], muted: Pick<MutedEvent, "source_type" | "username" | "reason">[]): HealthCard[] {
  const c = ruleCounts(rules);
  const broad = muted.filter(isBroadMute).length;
  return [
    {
      id: "enabled",
      label: "Rules enabled",
      value: String(c.enabled),
      of: `of ${c.total}`,
      tone: c.total === 0 ? "high" : "neutral",
      ratio: c.total > 0 ? c.enabled / c.total : null,
      detail: c.total === 0 ? "No rules loaded. Check the rules/ directory and restart." : `${c.serious} alert on high or critical events.`,
      href: "#catalog",
      cta: "Show rules",
    },
    {
      id: "disabled",
      label: "Rules disabled",
      value: String(c.disabled),
      tone: c.disabled > 0 ? "medium" : "ok",
      ratio: null,
      detail: c.disabled > 0 ? "Switched off at runtime. They detect nothing." : "Nothing is switched off.",
      href: "#catalog",
      cta: "Show rules",
    },
    {
      id: "suppress",
      label: "Suppress rules",
      value: String(c.suppress),
      tone: "neutral",
      ratio: null,
      detail: "Rules that hide events instead of alerting.",
      href: "#catalog",
      cta: "Show rules",
    },
    {
      id: "muted",
      label: "Muted filters",
      value: String(muted.length),
      tone: broad > 0 ? "medium" : "neutral",
      ratio: null,
      detail: broad > 0 ? `${broad} mute${broad === 1 ? "s" : ""} a whole action. Events are dropped before storage.` : muted.length > 0 ? "Narrow mutes only." : "Nothing muted.",
      href: "#muted",
      cta: "Show muted",
    },
  ];
}
