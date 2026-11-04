"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_GROUPS, findGroupIdForPath, isNavActive, type NavEntry } from "./nav-config";

const COLLAPSED_KEY = "bw-sidenav-collapsed";
const CLOSED_GROUPS_KEY = "bw-sidenav-closed-groups";

function readClosedGroups(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CLOSED_GROUPS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function SideNav({ mobileOpen = false, onCloseMobile }: { mobileOpen?: boolean; onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
      setClosedGroups(readClosedGroups());
    } catch {
      /* storage unavailable: keep defaults */
    }
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (mobileOpen) onCloseMobile?.();
    // Close the mobile drawer only when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggle = () =>
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const toggleGroup = (id: string) =>
    setClosedGroups((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      try {
        localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  if (!desktop && !mobileOpen) return null;
  const compact = collapsed && desktop;
  const activeGroup = findGroupIdForPath(pathname);

  return (
    <>
      {!desktop && mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 cursor-pointer bg-black/60 md:hidden"
        />
      )}
      <aside
        className={`${desktop ? "relative shrink-0" : "fixed inset-y-0 left-0 z-50 w-64 shadow-2xl"} ${compact ? "w-14" : "w-60"} border-r border-line bg-canvas text-fg`}
      >
        <nav
          id="mobile-navigation"
          aria-label="Primary"
          className="flex h-full min-h-0 flex-col overflow-y-auto bg-canvas"
        >
          <div className="py-2">
            {NAV_GROUPS.map((group, index) => {
              // The group holding the current page is always shown open so the
              // active item can never be hidden by a collapsed heading.
              const open = compact || group.id === activeGroup || !closedGroups.includes(group.id);
              return (
                <div key={group.id} className={index > 0 ? "mt-1" : undefined}>
                  {compact ? (
                    index > 0 && <div className="mx-3 my-2 h-px bg-line-soft" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={open}
                      aria-controls={`nav-group-${group.id}`}
                      className="mx-2 mt-2 flex min-h-8 w-[calc(100%-1rem)] cursor-pointer items-center justify-between rounded px-3 text-xs font-medium text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        size={12}
                        aria-hidden="true"
                        className={`transition-transform ${open ? "" : "-rotate-90"}`}
                      />
                    </button>
                  )}
                  {open && (
                    <div id={`nav-group-${group.id}`}>
                      {group.items.map((item) => (
                        <NavItem key={item.href} item={item} pathname={pathname} collapsed={compact} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {desktop && (
            <button
              type="button"
              onClick={toggle}
              aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
              className="mt-auto flex h-11 shrink-0 cursor-pointer items-center justify-center border-t border-line-soft text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal/70 md:h-10"
            >
              {compact ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            </button>
          )}
        </nav>
      </aside>
    </>
  );
}

function NavItem({ item, pathname, collapsed }: { item: NavEntry; pathname: string; collapsed: boolean }) {
  const Icon = item.icon;
  const active = isNavActive(item, pathname);
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`relative mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 md:min-h-9 ${collapsed ? "justify-center px-0" : ""} ${active ? "bg-signal/10 text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg"}`}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-signal" />}
      <Icon size={15} strokeWidth={1.5} />
      <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
    </Link>
  );
}
