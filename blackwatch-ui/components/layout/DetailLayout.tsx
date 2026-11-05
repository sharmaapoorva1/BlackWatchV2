import { SectionNav, type NavGroup } from "./SectionNav";

/**
 * Shell for a long detail page: a table of contents on the left, the sections
 * on the right. One grid does all the arranging.
 *
 * Pair it with `StickyHeader` for the full effect: the header stays pinned at
 * the top, the contents stay pinned beneath it on the left, and only the
 * sections scroll. The contents' offset and height follow the header's real
 * height through the `--sticky-header-h` variable, so nothing overlaps even if
 * the header wraps. Without a StickyHeader the variable is unset (0) and the
 * contents simply stick near the top.
 *
 * Below `lg` the contents become a plain "On this page" disclosure above the
 * sections; nothing floats over the content.
 */
export function DetailLayout({ nav, children }: { nav: NavGroup[]; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <aside className="min-w-0 lg:sticky lg:top-[max(0px,calc(var(--sticky-header-h,0px)+1rem-var(--main-pad-top,0px)))] lg:max-h-[calc(100dvh-var(--sticky-header-h,0px)-6rem)] lg:self-start lg:overflow-y-auto">
        <SectionNav groups={nav} />
      </aside>
      <div className="flex min-w-0 flex-col gap-10">{children}</div>
    </div>
  );
}
