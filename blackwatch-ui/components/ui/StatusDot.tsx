import Box from "@mui/material/Box";

export type Severity = "critical" | "high" | "medium" | "low" | "resolved" | "neutral";

const COLOR_MAP: Record<Severity, string> = {
  critical: "severity.critical",
  high: "severity.high",
  medium: "severity.medium",
  low: "severity.low",
  resolved: "severity.resolved",
  neutral: "text.disabled",
};

export function StatusDot({
  severity = "neutral",
  className,
}: {
  severity?: Severity;
  className?: string;
}) {
  return (
    <Box
      aria-hidden
      className={className}
      sx={{ display: "inline-block", width: 6, height: 6, flexShrink: 0, borderRadius: "50%", bgcolor: COLOR_MAP[severity] }}
    />
  );
}
