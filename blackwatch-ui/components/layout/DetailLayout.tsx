import { SectionNav, type NavGroup } from "./SectionNav";

/**
 * Shell for a long detail page. Up to three columns, arranged by one grid:
 *
 *   [ contents ]  [ sections … scroll … ]  [ summary ]
 *
 * - Left: a table of contents (`nav`). Sticky on wide screens; a plain
 *   disclosure above the content on narrow ones.
 * - Middle: the sections. This is the only part that scrolls past.
 * - Right (optional `aside`): a summary that stays in view while you read, such
 *   as who or what this page is about. It only appears from `xl` up, where
 *   there is room; below that the page header already carries the basics, so
 *   nothing is duplicated or floating over the content.
 *
 * Both rails are `sticky` inside the page's scroll area, so they stay put
 * together while the middle column moves.
 */
export function DetailLayout({
  nav,
  aside,
  children,
}: {
  nav: NavGroup[];
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        aside
          ? "grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[13rem_minmax(0,1fr)_17rem]"
          : "grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10"
      }
    >
      <aside className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
        <SectionNav groups={nav} />
      </aside>
      <div className="flex min-w-0 flex-col gap-10">{children}</div>
      {aside && (
        <aside
          aria-label="Summary"
          className="hidden min-w-0 xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-auto"
        >
          {aside}
        </aside>
      )}
    </div>
  );
}
