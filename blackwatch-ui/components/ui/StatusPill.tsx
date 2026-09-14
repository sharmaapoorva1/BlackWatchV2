import { StatusDot, type Severity } from "./StatusDot";
import { Box, Typography } from "@mui/material";

/** Inline status label used in tables and compact summaries. */
export function StatusPill({
  label,
  severity = "neutral",
  title,
  className,
}: {
  label: React.ReactNode;
  severity?: Severity;
  title?: string;
  className?: string;
}) {
  return (
    <Box
      title={title}
      className={className}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
    >
      <StatusDot severity={severity} />
      <Typography variant="body2" component="span">{label}</Typography>
    </Box>
  );
}
