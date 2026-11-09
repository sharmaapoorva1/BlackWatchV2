import type { FimCoverage, FimHostRow } from "./types";
import type { HealthCard } from "./overview";

const n = (value: number) => value.toLocaleString("en-US");
const plural = (count: number, word: string) => `${n(count)} ${word}${count === 1 ? "" : "s"}`;

export function humanAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Cross-host cards: hosts that stopped reporting, coverage gaps, scan errors, recent changes. */
export function buildFimOverviewCards(hosts: FimHostRow[], recentChanges: number): HealthCard[] {
  const total = hosts.length;
  const stale = hosts.filter((h) => h.stale).length;
  const noRealtime = hosts.filter((h) => !h.inotify_active).length;
  const noWhodata = hosts.filter((h) => !h.auditd_active).length;
  const errors = hosts.filter((h) => h.scan_errors > 0).length;
  const files = hosts.reduce((sum, h) => sum + h.files_tracked, 0);
  return [
    {
      id: "stale",
      label: "Hosts not reporting",
      value: n(stale),
      of: `of ${n(total)}`,
      tone: stale > 0 ? "critical" : "ok",
      ratio: total > 0 ? stale / total : null,
      detail: stale > 0 ? "File changes on these hosts are going unseen." : total > 0 ? "Every host is reporting." : "No hosts yet.",
      href: "#hosts",
      cta: "Show hosts",
    },
    {
      id: "realtime",
      label: "No real-time watching",
      value: n(noRealtime),
      of: `of ${n(total)}`,
      tone: noRealtime > 0 ? "high" : "ok",
      ratio: total > 0 ? noRealtime / total : null,
      detail: noRealtime > 0 ? "Changes are only caught at the next 6h scan." : "inotify is active everywhere.",
      href: "#hosts",
      cta: "Show hosts",
    },
    {
      id: "whodata",
      label: "No actor attribution",
      value: n(noWhodata),
      of: `of ${n(total)}`,
      tone: noWhodata > 0 ? "medium" : "ok",
      ratio: total > 0 ? noWhodata / total : null,
      detail: noWhodata > 0 ? "auditd is off, so changes cannot be tied to a user or process." : "auditd is active everywhere.",
      href: "#hosts",
      cta: "Show hosts",
    },
    {
      id: "errors",
      label: "Hosts with scan errors",
      value: n(errors),
      tone: errors > 0 ? "medium" : "ok",
      ratio: null,
      detail: errors > 0 ? "Some paths could not be read." : `${plural(files, "file")} tracked across all hosts.`,
      href: "#hosts",
      cta: "Show hosts",
    },
    {
      id: "changes",
      label: "Recent changes",
      value: n(recentChanges),
      tone: "neutral",
      ratio: null,
      detail: "Latest file integrity changes across all hosts.",
      href: "#activity",
      cta: "Show changes",
    },
  ];
}

/** Per-host coverage cards. `now` is passed in so the age label is testable. */
export function buildFimCoverageCards(coverage: FimCoverage, now: number): HealthCard[] {
  const scanAge = coverage.last_full_scan_at ? humanAge((now - new Date(coverage.last_full_scan_at).getTime()) / 1000) : "—";
  return [
    {
      id: "realtime",
      label: "Real-time (inotify)",
      value: coverage.inotify_active ? "Active" : "Inactive",
      tone: coverage.inotify_active ? "ok" : "high",
      ratio: null,
      detail: coverage.inotify_active ? `${plural(coverage.inotify_watch_count, "watch")}, sub-second.` : "Changes wait for the next full scan.",
      href: "#paths",
      cta: "Show paths",
    },
    {
      id: "whodata",
      label: "Whodata (auditd)",
      value: coverage.auditd_active ? "Active" : "Inactive",
      tone: coverage.auditd_active ? "ok" : "medium",
      ratio: null,
      detail: coverage.auditd_active ? "Actor attribution is on." : "Changes will not show who made them.",
      href: "#paths",
      cta: "Show paths",
    },
    {
      id: "files",
      label: "Files tracked",
      value: n(coverage.files_tracked),
      of: `in ${plural(coverage.paths_configured, "path")}`,
      tone: "neutral",
      ratio: null,
      detail: "Baselined and compared on every scan.",
      href: "#paths",
      cta: "Show paths",
    },
    {
      id: "scan",
      label: "Last full scan",
      value: scanAge,
      tone: coverage.last_full_scan_at ? "neutral" : "medium",
      ratio: null,
      detail: coverage.last_full_scan_at ? "A full scan runs every 6 hours." : "No full scan has completed yet.",
      href: "#paths",
      cta: "Show paths",
    },
    {
      id: "errors",
      label: "Scan errors",
      value: n(coverage.scan_errors),
      tone: coverage.scan_errors > 0 ? "medium" : "ok",
      ratio: null,
      detail: coverage.scan_errors > 0 ? "Some paths could not be read." : "Every path was readable.",
      href: "#paths",
      cta: "Show paths",
    },
  ];
}
