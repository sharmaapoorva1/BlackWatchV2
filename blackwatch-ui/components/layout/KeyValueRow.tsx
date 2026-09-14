import { Box, Typography } from "@mui/material";

// Two-column key/value row. Label left, value right. Used for status panels.
export function KeyValueRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Box component="div" className={className} sx={{ display: "grid", minWidth: 0, gridTemplateColumns: { xs: "1fr", sm: "minmax(140px,1fr) minmax(0,2fr)" }, alignItems: "baseline", gap: { xs: 0.5, sm: 2 }, borderBottom: 1, borderColor: "divider", px: 2, py: 1.25, "&:last-child": { borderBottom: 0 } }}>
      <Typography component="dt" variant="caption" sx={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</Typography>
      <Typography component="dd" variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere", color: "text.primary" }}>{children}</Typography>
    </Box>
  );
}
