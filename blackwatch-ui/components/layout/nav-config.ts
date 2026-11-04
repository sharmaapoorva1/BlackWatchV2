import type { ComponentType } from "react";
import {
  Activity,
  Archive,
  Bell,
  ClipboardList,
  Database,
  FileLock2,
  Globe,
  HardDrive,
  Key,
  LayoutDashboard,
  Lock,
  Package,
  Plug,
  Radar,
  ScrollText,
  SearchCheck,
  Server,
  Settings as SettingsIcon,
  Shield,
  UserSearch,
  Wrench,
} from "lucide-react";

export type NavIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

export type NavEntry = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Extra words the command palette matches against. */
  keywords?: string;
  /** Second key of the `g` + key go-to chord, if any. */
  chord?: string;
  /** Other routes that belong to this item (highlight it, keep its group open). */
  alsoActive?: string[];
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavEntry[];
};

// One source of truth for the sidebar and the command palette. Groups answer
// "what kind of thing is this?": watching, the assets being watched, the
// detection content, the response path, and platform plumbing.
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "monitor",
    label: "Monitor",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard", chord: "o" },
      { href: "/events", label: "Events", icon: Activity, keywords: "feed logs search", chord: "e" },
      { href: "/investigations", label: "Investigations", icon: SearchCheck, keywords: "cases hunt", chord: "i" },
    ],
  },
  {
    id: "assets",
    label: "Assets",
    items: [
      { href: "/hosts", label: "Hosts", icon: HardDrive, keywords: "ec2 agents servers", chord: "h" },
      { href: "/services", label: "Services", icon: Server, keywords: "probes uptime", chord: "s" },
      { href: "/vpn", label: "VPN", icon: Lock, keywords: "openvpn sessions" },
      { href: "/rds", label: "RDS", icon: Database, keywords: "database postgres proxy" },
      { href: "/api-gw", label: "API Gateway", icon: Globe, keywords: "api requests" },
      { href: "/storage", label: "Storage", icon: Archive, keywords: "efs ebs snapshots secrets s3 buckets", alsoActive: ["/buckets"] },
    ],
  },
  {
    id: "detection",
    label: "Detection",
    items: [
      { href: "/aws-posture", label: "AWS posture", icon: Shield, keywords: "findings drift misconfiguration", chord: "p" },
      { href: "/iam", label: "IAM", icon: Key, keywords: "cloudtrail identity logins" },
      { href: "/fim", label: "File integrity", icon: FileLock2, keywords: "fim files changes" },
      { href: "/ueba", label: "UEBA", icon: UserSearch, keywords: "anomalies baselines behavior" },
      { href: "/rules", label: "Rules", icon: ScrollText, keywords: "detections severity", chord: "r" },
    ],
  },
  {
    id: "respond",
    label: "Respond",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell, keywords: "alerts channels slack routes", chord: "n" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/connectors", label: "Connectors", icon: Plug, keywords: "sqs sources pull", chord: "c" },
      { href: "/coverage", label: "Coverage", icon: Radar, keywords: "gaps sources" },
      { href: "/audit", label: "Audit log", icon: ClipboardList, keywords: "changes history" },
      { href: "/tools", label: "Tools", icon: Wrench, keywords: "ip dns lookup" },
      { href: "/settings", label: "Settings", icon: SettingsIcon, keywords: "account config" },
    ],
  },
];

// Reachable from the command palette but not shown in the sidebar: pages that
// live under another item (Buckets is a view inside Storage).
const PALETTE_ONLY_ITEMS: NavEntry[] = [
  { href: "/buckets", label: "S3 buckets", icon: Package, keywords: "s3 storage inventory public" },
];

export const ALL_NAV_ITEMS: NavEntry[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  ...PALETTE_ONLY_ITEMS,
];

function matches(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function isNavActive(item: Pick<NavEntry, "href" | "alsoActive">, pathname: string): boolean {
  return matches(item.href, pathname) || (item.alsoActive ?? []).some((href) => matches(href, pathname));
}

export function findGroupIdForPath(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    if (group.items.some((item) => isNavActive(item, pathname))) return group.id;
  }
  return null;
}
