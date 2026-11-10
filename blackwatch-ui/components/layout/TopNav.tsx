"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Rows3, LogOut, Menu as MenuIcon, Search, Settings as SettingsIcon, X } from "lucide-react";
import { LiveCounter } from "./LiveCounter";
import { SystemHealth } from "./SystemHealth";
import { logoutAction } from "@/app/login/actions";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

const iconButton =
  "inline-flex h-11 w-11 cursor-pointer items-center justify-center text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70";

export function TopNav({
  onMenuClick,
  menuOpen = false,
  onSearchClick,
}: {
  onMenuClick?: () => void;
  menuOpen?: boolean;
  onSearchClick?: () => void;
}) {
  return (
    <header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2 sm:px-3 md:px-4">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
        className={`${iconButton} md:hidden`}
      >
        {menuOpen ? <X size={16} /> : <MenuIcon size={16} />}
      </button>
      <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70" aria-label="BlackWatch overview">
        <Logo />
        <span className="hidden font-mono text-xs text-fg-muted sm:inline">blackwatch</span>
      </Link>

      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Search events, IPs, hosts or pages"
        aria-keyshortcuts="Control+K Meta+K /"
        className="ml-2 inline-flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-1 px-3 text-sm text-fg-subtle transition-colors hover:border-signal/60 hover:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:max-w-md md:min-h-8"
      >
        <Search size={14} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Search events, IPs, hosts…</span>
        <kbd className="hidden shrink-0 rounded border border-line px-1.5 font-mono text-xs text-fg-subtle sm:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
        <span className="hidden md:block"><LiveCounter /></span>
        <SystemHealth />
        <Link href="/settings" aria-label="Settings" className={`${iconButton} md:h-8 md:w-8`}>
          <SettingsIcon size={15} strokeWidth={1.5} />
        </Link>
        <AccountMenu />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span aria-hidden className="grid h-6 w-6 place-items-center border border-signal text-xs font-medium leading-none text-signal">
      BW
    </span>
  );
}

const DENSITY_KEY = "bw-table-density";

function AccountMenu() {
  const [compact, setCompact] = useState(false);
  const logoutForm = useRef<HTMLFormElement>(null);
  const { user, role, loading } = useAuth();
  const initials = (user ?? "??").slice(0, 2).toUpperCase();
  const viewer = !loading && role === "viewer";

  // Table density is a per-browser preference applied as a data attribute on
  // <html>; globals.css does the rest. Restored once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DENSITY_KEY) === "compact";
      setCompact(saved);
      document.documentElement.dataset.density = saved ? "compact" : "comfortable";
    } catch {
      /* storage unavailable: stay comfortable */
    }
  }, []);

  const setDensity = (next: boolean) => {
    setCompact(next);
    document.documentElement.dataset.density = next ? "compact" : "comfortable";
    try {
      localStorage.setItem(DENSITY_KEY, next ? "compact" : "comfortable");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-center gap-2">
      {viewer && (
        <Badge className="hidden sm:inline-flex">viewer</Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-md border border-line bg-surface-1 font-mono text-xs text-fg-muted transition-colors hover:border-signal data-[state=open]:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 md:h-8 md:w-8"
          >
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="truncate text-sm text-fg">{user ?? "unknown"}</div>
            <div className="font-mono text-xs text-fg-subtle">{loading ? "…" : role}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings"><SettingsIcon size={15} /> Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={compact} onCheckedChange={setDensity}>
            <Rows3 size={15} /> Compact tables
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logoutForm.current?.requestSubmit()}>
            <LogOut size={15} /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <form ref={logoutForm} action={logoutAction} className="hidden" aria-hidden="true" />
    </div>
  );
}
