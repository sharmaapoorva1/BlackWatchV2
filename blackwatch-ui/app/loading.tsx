// Shown while a page's server data loads during navigation. Keeps the shell
// and layout stable (no blank flash) and reserves roughly the page's shape.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page" role="status" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-1" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-20 animate-pulse border border-line-soft bg-surface-1" />
        ))}
      </div>
      <div className="border border-line-soft bg-surface-1">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-11 animate-pulse border-b border-line-soft last:border-0" />
        ))}
      </div>
    </div>
  );
}
