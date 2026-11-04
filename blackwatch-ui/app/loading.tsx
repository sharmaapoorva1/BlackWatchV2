import { Skeleton } from "@/components/ui/Skeleton";

// Shown while a page's server data loads during navigation. Keeps the shell
// and layout stable (no blank flash) and reserves roughly the page's shape.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page" role="status" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full bg-surface-1" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-20 rounded-md border border-line-soft bg-surface-1" />
        ))}
      </div>
      <div className="rounded-md border border-line-soft bg-surface-1">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-11 rounded-none border-b border-line-soft bg-transparent last:border-0" />
        ))}
      </div>
    </div>
  );
}
