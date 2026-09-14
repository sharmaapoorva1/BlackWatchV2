import { StatusDot } from "./StatusDot";
import { Box, Typography } from "@mui/material";

type EmptyStateSize = "sm" | "md" | "lg";
type EmptyStateTone = "neutral" | "ok";

const SIZE_PADDING: Record<EmptyStateSize, number> = {
  sm: 4,
  md: 5,
  lg: 8,
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
    <Box className={className} sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, px: 3, py: SIZE_PADDING[size], textAlign: "center" }}>
      {tone === "ok" && <StatusDot severity="resolved" />}
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}
