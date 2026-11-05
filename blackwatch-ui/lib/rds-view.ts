import type { HealthCard } from "./overview";

const n = (value: number) => value.toLocaleString("en-US");

export function buildRdsCards(input: {
  databases: number;
  active: number;
  authFailures: number;
  authHours: number;
  alerts: number;
  alertHours: number;
  sources: number;
}): HealthCard[] {
  return [
    {
      id: "alerts",
      label: "Credential alerts",
      value: n(input.alerts),
      tone: input.alerts > 0 ? "high" : "ok",
      ratio: null,
      detail:
        input.alerts > 0
          ? `New source, new user+IP or unknown user in the last ${input.alertHours}h.`
          : `No stolen-credential or new-source alerts in the last ${input.alertHours}h.`,
      href: "#alerts",
      cta: "Show alerts",
    },
    {
      id: "auth",
      label: "Auth failures",
      value: n(input.authFailures),
      tone: input.authFailures > 0 ? "critical" : "ok",
      ratio: null,
      detail: input.authFailures > 0 ? `Failed database logins in the last ${input.authHours}h.` : `No failed logins in the last ${input.authHours}h.`,
      href: "#auth",
      cta: "Show failures",
    },
    {
      id: "sessions",
      label: "Active sessions",
      value: n(input.active),
      of: `on ${n(input.databases)} database${input.databases === 1 ? "" : "s"}`,
      tone: "neutral",
      ratio: null,
      detail: input.databases === 0 ? "No RDS activity ingested yet." : "Connected right now.",
      href: "#connected",
      cta: "Show sessions",
    },
    {
      id: "sources",
      label: "Proxy source IPs",
      value: n(input.sources),
      tone: "neutral",
      ratio: null,
      detail: "Real client IPs seen at the RDS Proxy.",
      href: "#sources",
      cta: "Show source IPs",
    },
  ];
}

export function allowlistSummary(humans: number, services: number): string {
  return `${humans} human${humans === 1 ? "" : "s"} · ${services} service${services === 1 ? "" : "s"}`;
}
