import { Box, Typography } from "@mui/material";

export function ReviewGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Box component="dl" className={className} sx={{ display: "grid", minWidth: 0, gridTemplateColumns: { xs: "1fr", sm: "minmax(140px,1fr) minmax(0,2fr)" }, rowGap: { xs: 1, sm: 1.5 }, fontSize: 14 }}>
      {children}
    </Box>
  );
}

export function ReviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="dt" sx={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>{children}</Typography>
  );
}

export function ReviewValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <Typography component="dd" className={className} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</Typography>;
}
