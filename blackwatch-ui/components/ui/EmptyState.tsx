import { StatusDot } from "./StatusDot";
import { cn } from "@/lib/utils";

type EmptyStateSize = "sm" | "md" | "lg";
type EmptyStateTone = "neutral" | "ok";

const SIZE_PADDING: Record<EmptyStateSize, string> = {
  sm: "py-4",
  md: "py-5",
  lg: "py-8",
};

/**
 * Shared empty content treatment for panels and data views. Say what is empty
 * and why that is fine (or what to do), and give the next step as `action`
 * when there is one: an empty panel should never be a dead end.
 */
export function EmptyState({
  children,
  size = "md",
  tone = "neutral",
  icon,
  action,
  className,
}: {
  children: React.ReactNode;
  size?: EmptyStateSize;
  tone?: EmptyStateTone;
  /** Optional decorative icon shown above the message. */
  icon?: React.ReactNode;
  /** Optional next step, for example a link-button to add the first item. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 text-center", SIZE_PADDING[size], className)}>
      {icon && (
        <span aria-hidden="true" className="text-fg-subtle">
          {icon}
        </span>
      )}
      <div className="flex items-center justify-center gap-2">
        {tone === "ok" && <StatusDot severity="resolved" />}
        <div className="text-sm">{children}</div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
