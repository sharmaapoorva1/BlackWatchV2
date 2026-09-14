"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Server,
  HardDrive,
  Activity,
  ScrollText,
  Shield,
  Database,
  Bell,
  Plug,
  Settings as SettingsIcon,
  Lock,
  Wrench,
  ClipboardList,
  Key,
  Globe,
  UserSearch,
  FileLock2,
  Archive,
  Radar,
  SearchCheck,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { appTheme } from "@/theme";

type NavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const primaryNav: NavEntry[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/services", label: "Services", icon: Server },
  { href: "/hosts", label: "Hosts", icon: HardDrive },
  { href: "/fim", label: "File integrity", icon: FileLock2 },
  { href: "/vpn", label: "VPN", icon: Lock },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/iam", label: "IAM", icon: Key },
  { href: "/rds", label: "RDS", icon: Database },
  { href: "/api-gw", label: "API Gateway", icon: Globe },
  { href: "/rules", label: "Rules", icon: ScrollText },
  { href: "/aws-posture", label: "AWS posture", icon: Shield },
  { href: "/ueba", label: "UEBA", icon: UserSearch },
  { href: "/buckets", label: "Buckets", icon: Database },
  { href: "/storage", label: "Storage", icon: Archive },
  { href: "/investigations", label: "Investigations", icon: SearchCheck },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const secondaryNav: NavEntry[] = [
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/coverage", label: "Coverage", icon: Radar },
  { href: "/connectors", label: "Connectors", icon: Plug },
  { href: "/audit", label: "Audit log", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const STORAGE_KEY = "bw-sidenav-collapsed";

// Desktop: fixed rail. Mobile: off-canvas drawer opened via the TopNav
// hamburger — position:fixed + backdrop. The parent AppShell controls the
// mobile open/close state; this component just renders both modes.
export function SideNav({
  mobileOpen = false,
  onCloseMobile,
}: {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const desktop = useMediaQuery(appTheme.breakpoints.up("md"), { noSsr: true });

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "true") setCollapsed(true);
  }, []);

  // Close mobile drawer on route change — otherwise a nav click leaves the
  // drawer open on top of the newly-loaded page.
  useEffect(() => {
    if (mobileOpen) onCloseMobile?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore quota / private-mode errors */
      }
      return next;
    });
  }

  const content = (
    <Box component="nav" id="mobile-navigation" aria-label="Primary" sx={{ display: "flex", minHeight: 0, height: "100%", flexDirection: "column", bgcolor: "background.paper" }}>
      <List disablePadding sx={{ flex: 1, minHeight: 0, overflowY: "auto", py: 1, bgcolor: "background.paper" }}>
          {primaryNav.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed && !mobileOpen}
            />
          ))}
          <Box sx={{ height: 1, bgcolor: "divider", mx: 2, my: 1 }} />
          {secondaryNav.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed && !mobileOpen}
            />
          ))}
      </List>

      <Box sx={{ display: { xs: "none", md: "flex" }, height: 40, borderTop: 1, borderColor: "divider", alignItems: "center", justifyContent: "center" }}>
        <IconButton onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} size="small">
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </IconButton>
      </Box>
    </Box>
  );

  if (!desktop) {
    return <Drawer variant="temporary" open={mobileOpen} onClose={onCloseMobile} ModalProps={{ keepMounted: true }} sx={{ "& .MuiDrawer-paper": { width: 256, bgcolor: "background.paper", backgroundImage: "none" } }}>{content}</Drawer>;
  }

  return <Drawer variant="permanent" open sx={{ width: collapsed ? 56 : 224, flexShrink: 0, "& .MuiDrawer-paper": { width: collapsed ? 56 : 224, position: "relative", height: "100%", overflow: "hidden", transition: appTheme.transitions.create("width", { duration: 200 }) } }}>{content}</Drawer>;
}

function NavItem({
  item,
  active,
  collapsed,
}: {
  item: NavEntry;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const button = (
    <ListItemButton component={Link} href={item.href} selected={active} sx={{ minHeight: 40, mx: 1, px: 1.25, gap: 1.5, borderRadius: 1, justifyContent: collapsed ? "center" : "initial", "&.Mui-selected": { color: "text.primary", bgcolor: "rgba(72, 212, 232, 0.08)", borderLeft: 2, borderColor: "signal.main" }, "&:hover": { bgcolor: "rgba(255,255,255,0.04)" } }}>
      <ListItemIcon sx={{ minWidth: 20, color: active ? "signal.main" : "text.secondary" }}><Icon size={14} strokeWidth={1.5} /></ListItemIcon>
      {!collapsed && <ListItemText primary={item.label} slotProps={{ primary: { noWrap: true, sx: { fontSize: 14 } } }} />}
    </ListItemButton>
  );
  return collapsed ? <Tooltip title={item.label} placement="right">{button}</Tooltip> : button;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
