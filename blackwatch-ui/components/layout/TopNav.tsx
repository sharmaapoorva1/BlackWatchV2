"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Rows3, LogOut, Menu as MenuIcon, Search, Settings as SettingsIcon, X } from "lucide-react";
import { LiveCounter } from "./LiveCounter";
import { SystemHealth } from "./SystemHealth";
import { logoutAction } from "@/app/login/actions";
import { useAuth } from "@/components/auth/AuthProvider";

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
        <span className="hidden font-mono text-xs tracking-[0.18em] text-fg-muted sm:inline">blackwatch</span>
      </Link>

      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Search events, IPs, hosts or pages"
        aria-keyshortcuts="Control+K Meta+K /"
        className="ml-2 inline-flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 border border-line bg-surface-1 px-3 text-sm text-fg-subtle transition-colors hover:border-signal/60 hover:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 sm:max-w-md md:min-h-8"
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
    <span aria-hidden className="grid h-6 w-6 place-items-center border border-signal text-[10px] font-medium leading-none text-signal">
      BW
    </span>
  );
}

const DENSITY_KEY = "bw-table-density";

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);

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

  const toggleDensity = () => {
    const next = !compact;
    setCompact(next);
    document.documentElement.dataset.density = next ? "compact" : "comfortable";
    try {
      localStorage.setItem(DENSITY_KEY, next ? "compact" : "comfortable");
    } catch {
      /* ignore */
    }
  };

  const { user, role, loading } = useAuth();
  const initials = (user ?? "??").slice(0, 2).toUpperCase();
  const viewer = !loading && role === "viewer";
  return (
    <div className="relative flex items-center gap-2">
      {viewer && (
        <span className="hidden border border-line px-1.5 py-0.5 font-mono text-xs text-fg-muted sm:inline">viewer</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-11 w-11 cursor-pointer place-items-center rounded-sm border border-line bg-surface-1 font-mono text-xs text-fg-muted transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 md:h-8 md:w-8"
      >
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 min-w-52 border border-line bg-surface-1 p-1 shadow-xl md:top-9">
          <div className="px-3 py-2">
            <div className="truncate text-sm text-fg">{user ?? "unknown"}</div>
            <div className="font-mono text-xs text-fg-subtle">{loading ? "…" : role}</div>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            <SettingsIcon size={15} /> Settings
          </Link>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={compact}
            onClick={toggleDensity}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            <Rows3 size={15} /> Compact tables
            <span className="ml-auto font-mono text-xs text-fg-subtle">{compact ? "on" : "off"}</span>
          </button>
          <form action={logoutAction}>
            <button
              type="submit"
              onClick={() => setOpen(false)}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              <LogOut size={15} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
