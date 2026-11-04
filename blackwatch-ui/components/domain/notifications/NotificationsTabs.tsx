"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Section tabs for the three top-level notification screens. Rendered by
// app/notifications/layout.tsx and shown only on those screens: wizards and
// editors keep their own focused chrome so the tabs do not compete with them.
const TABS = [
  { href: "/notifications", label: "Alerts and channels", exact: true },
  { href: "/notifications/profiles", label: "Message studio", exact: false },
  { href: "/notifications/log", label: "Delivery log", exact: true },
] as const;

export function NotificationsTabs() {
  const pathname = usePathname();
  const visible = TABS.some((tab) =>
    tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/"),
  );
  if (!visible) return null;

  return (
    <nav aria-label="Notifications sections" className="mb-5 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70 sm:min-h-10 ${
                  active
                    ? "border-signal text-fg"
                    : "border-transparent text-fg-muted hover:text-fg"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
