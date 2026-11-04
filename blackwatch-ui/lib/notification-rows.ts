import type {
  NotificationChannel,
  PerfAlertInstance,
  PerfAlertRule,
  Route,
  SeverityKey,
} from "./types";

// Slim, serializable row shapes for the notification tables. They carry only
// what is displayed or posted to an action: never channel `config` (which can
// hold webhook URLs), message templates or match trees.

export interface ChannelTableRow {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  last_status: string | null;
  last_error: string | null;
  last_sent_at: string | null;
}

export function toChannelRow(channel: NotificationChannel): ChannelTableRow {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    enabled: channel.enabled,
    last_status: channel.last_status,
    last_error: channel.last_error,
    last_sent_at: channel.last_sent_at,
  };
}

export interface RouteTableRow {
  id: string;
  name: string | null;
  kind: "simple" | "custom";
  enabled: boolean;
  silenced: boolean;
  channel: string | null;
  channels: string[];
  severities: SeverityKey[];
  module_label: string;
}

export function toRouteRow(route: Route): RouteTableRow {
  return {
    id: route.id,
    name: route.name,
    kind: route.kind,
    enabled: route.enabled,
    silenced: route.silenced,
    channel: route.channel,
    channels: route.channels ?? [],
    severities: route.severities,
    module_label: route.module_label,
  };
}

export function computeRouteState(route: Pick<RouteTableRow, "silenced" | "enabled" | "channel">): {
  label: string;
  className: string;
} {
  if (route.silenced) return { label: "silenced", className: "text-sev-medium" };
  if (!route.enabled) return { label: "off", className: "text-fg-subtle" };
  if (!route.channel) return { label: "no channel", className: "text-fg-subtle" };
  return { label: "on", className: "text-signal" };
}

export interface MetricRouteTableRow {
  id: string;
  name: string;
  metric: string;
  comparison: string;
  threshold: number;
  minutes: number;
  scope: string;
  channels: string[];
  enabled: boolean;
}

/** Scope as a human string, using host names instead of raw instance ids. */
export function scopeLabel(
  rule: Pick<PerfAlertRule, "instance_ids" | "instance_id" | "tag_key" | "tag_value">,
  instancesById: Map<string, PerfAlertInstance>,
  labelFor: (instance: PerfAlertInstance) => string,
): string {
  const resolve = (id: string) => {
    const instance = instancesById.get(id);
    return instance ? labelFor(instance) : id;
  };
  const ids = rule.instance_ids ?? [];
  if (ids.length > 0) {
    const names = ids.map(resolve);
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
  }
  if (rule.instance_id) return resolve(rule.instance_id);
  if (rule.tag_key) return `tag ${rule.tag_key}=${rule.tag_value}`;
  return "all hosts";
}

export function toMetricRouteRow(
  rule: PerfAlertRule,
  instancesById: Map<string, PerfAlertInstance>,
  labelFor: (instance: PerfAlertInstance) => string,
): MetricRouteTableRow {
  return {
    id: rule.id,
    name: rule.name,
    metric: rule.metric,
    comparison: rule.comparison,
    threshold: rule.threshold,
    minutes: Math.max(1, Math.round(rule.window_seconds / 60)),
    scope: scopeLabel(rule, instancesById, labelFor),
    channels: rule.channels ?? [],
    enabled: rule.enabled,
  };
}
