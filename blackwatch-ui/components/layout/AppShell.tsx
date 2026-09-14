"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";
import { Box, Container } from "@mui/material";

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
    return <Box sx={{ minHeight: "100dvh", minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}>{children}</Box>;
  }

  return (
    <Box sx={{ display: "flex", height: "100dvh", minWidth: 0, maxWidth: "100%", flexDirection: "column", overflow: "hidden" }}>
      <TopNav onMenuClick={() => setNavOpen((v) => !v)} menuOpen={navOpen} />
      <Box sx={{ display: "flex", minHeight: 0, minWidth: 0, flex: 1, overflow: "hidden" }}>
        <SideNav mobileOpen={navOpen} onCloseMobile={() => setNavOpen(false)} />
        <Box component="main" id="main-content" tabIndex={-1} aria-label="Main content" sx={{ minHeight: 0, minWidth: 0, flex: 1, overflowX: "hidden", overflowY: "auto", px: { xs: 1.5, md: 4 }, py: { xs: 2, md: 3 } }}>
          <div data-impeccable-variants="e6f6884f" data-impeccable-variant-count="3" style={{ display: "contents" }}>
            {/* impeccable-variants-start e6f6884f */}
            {/* Original */}
            <div data-impeccable-variant="original">
              <Container maxWidth={false} disableGutters sx={{ width: "100%", maxWidth: 1280, minWidth: 0, mx: "auto" }}>{children}</Container>
            </div>
            {/* Variants: insert below this line */}
            {/* impeccable-variants-end e6f6884f */}
          </div>
        </Box>
      </Box>
    </Box>
  );
}
