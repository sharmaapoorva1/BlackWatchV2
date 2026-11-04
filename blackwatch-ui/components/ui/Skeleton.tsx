import { cn } from "@/lib/utils";

/** Pulsing placeholder block. Size it with className (h-*, w-*). The pulse is
 *  switched off for users who prefer reduced motion in globals.css. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface-2", className)} {...props} />;
}
