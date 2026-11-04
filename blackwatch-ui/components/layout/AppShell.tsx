"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";
import { CommandPalette } from "./CommandPalette";
import { RefreshStatus } from "./RefreshStatus";
import { EventPeekHost } from "@/components/domain/EventPeek";

// Root layout. Desktop = fixed sidebar + scrollable main; mobile = drawer
// nav opened via the TopNav hamburger. The auth pages (/login and any
// future sign-up) render bare — no chrome — so a not-yet-authenticated
// user doesn't see teasing navigation before they're allowed in.
//
// `min-h-dvh` prevents the iOS mobile-Safari 100vh trap where the
// toolbar overlaps the last row of content.
const CHROMELESS_PREFIXES = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const chromeless = CHROMELESS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  useEffect(() => {
    if (chromeless) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chromeless, pathname]);

  if (chromeless) {
    return <div className="min-h-dvh min-w-0 max-w-full overflow-x-hidden">{children}</div>;
  }

  return (
    <div className="flex h-dvh min-w-0 max-w-full flex-col overflow-hidden">
      <TopNav
        onMenuClick={() => setNavOpen((v) => !v)}
        menuOpen={navOpen}
        onSearchClick={() => setPaletteOpen(true)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <SideNav mobileOpen={navOpen} onCloseMobile={() => setNavOpen(false)} />
        <main id="main-content" tabIndex={-1} aria-label="Main content" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 md:px-6 md:py-5">
          {/* Wide cap: data tables use the screen on large monitors instead of
              leaving empty gutters; forms and prose pages size themselves. */}
          <div className="mx-auto min-w-0 w-full max-w-[1760px]">
            <RefreshStatus />
            {children}
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <EventPeekHost />
    </div>
  );
}
