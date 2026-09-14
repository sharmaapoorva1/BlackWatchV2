import clsx from "clsx";

type SeverityKey =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational"
  | string;

const CHIP_COLOR: Record<string, string> = {
  critical: "border-severity-critical/50 text-severity-critical",
  high: "border-severity-high/50 text-severity-high",
  medium: "border-severity-medium/50 text-severity-medium",
  low: "border-severity-low/50 text-severity-low",
  informational: "border-line text-muted",
};

const SHORT_LABEL: Record<string, string> = {
  informational: "info",
};

export function severityChipClass(severity: string): string {
  return CHIP_COLOR[severity] ?? CHIP_COLOR.informational;
}

export function SeverityChip({
  severity,
  className,
}: {
  severity: SeverityKey;
  className?: string;
}) {
  const label = SHORT_LABEL[severity] ?? severity;
  return (
    <span className={clsx("inline-flex h-[22px] items-center rounded border px-2 font-mono text-[10px]", severityChipClass(severity), className)}>{label}</span>
  );
}
