import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Compact label for a state or count. Severity colours are accents on the
// border and text only, never a filled background, matching the rest of the UI.
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-line text-fg-muted",
        signal: "border-signal/50 text-signal",
        critical: "border-sev-critical/50 text-sev-critical",
        high: "border-sev-high/50 text-sev-high",
        medium: "border-sev-medium/50 text-sev-medium",
        low: "border-sev-low/50 text-sev-low",
        ok: "border-sev-resolved/50 text-sev-resolved",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
