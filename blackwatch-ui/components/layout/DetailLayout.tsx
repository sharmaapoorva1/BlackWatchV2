import { SectionNav, type NavGroup } from "./SectionNav";

/**
 * Two-column shell for a long detail page: a table of contents on the left
 * (sticky on wide screens, a plain disclosure above the content on narrow
 * ones) and the sections on the right. One flex/grid container does all the
 * arranging, so there are no per-page breakpoints.
 *
 *   <DetailLayout nav={groups}>
 *     <Section id="access" …>…</Section>
 *   </DetailLayout>
 */
export function DetailLayout({ nav, children }: { nav: NavGroup[]; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <aside className="min-w-0 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
        <SectionNav groups={nav} />
      </aside>
      <div className="flex min-w-0 flex-col gap-10">{children}</div>
    </div>
  );
}
