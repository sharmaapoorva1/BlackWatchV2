import Chip from "@mui/material/Chip";

type SeverityKey =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational"
  | string;

const CHIP_COLOR: Record<string, string> = {
  critical: "severity.critical",
  high: "severity.high",
  medium: "severity.medium",
  low: "severity.low",
  informational: "text.secondary",
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
    <Chip label={label} size="small" variant="outlined" className={className} sx={{ borderColor: CHIP_COLOR[severity] ?? CHIP_COLOR.informational, color: CHIP_COLOR[severity] ?? CHIP_COLOR.informational, fontFamily: "monospace", fontSize: 10, height: 22 }} />
  );
}
