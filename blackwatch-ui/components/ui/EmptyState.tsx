import { StatusDot } from "./StatusDot";

type EmptyStateSize = "sm" | "md" | "lg";
type EmptyStateTone = "neutral" | "ok";

const SIZE_PADDING: Record<EmptyStateSize, string> = {
  sm: "py-4",
  md: "py-5",
  lg: "py-8",
};

/** Shared empty content treatment for panels and data views. */
export function EmptyState({
  children,
  size = "md",
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  size?: EmptyStateSize;
  tone?: EmptyStateTone;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-2 px-6 text-center ${SIZE_PADDING[size]} ${className ?? ""}`}>
      {tone === "ok" && <StatusDot severity="resolved" />}
      <p className="text-sm">{children}</p>
    </div>
  );
}
