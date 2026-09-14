import Link from "next/link";
import { Box, Link as MuiLink, Typography } from "@mui/material";

export function PickerCard({
  href,
  icon,
  title,
  blurb,
  badge,
  dashed = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  badge?: string;
  dashed?: boolean;
}) {
  return (
    <MuiLink
      component={Link}
      href={href}
      underline="none"
      sx={{ display: "flex", flexDirection: "column", gap: 1, px: 2, py: 2, border: 1, borderStyle: dashed ? "dashed" : "solid", borderColor: "divider", bgcolor: dashed ? "transparent" : "background.paper", color: "text.primary", "&:hover": { bgcolor: "background.default", borderColor: "text.secondary" } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ color: "text.secondary" }}>{icon}</Box>
        <Typography variant="body2" color="text.primary">{title}</Typography>
        {badge && (
          <Typography component="code" variant="caption" sx={{ ml: "auto", fontFamily: "monospace" }}>{badge}</Typography>
        )}
      </Box>
      <Typography variant="caption">{blurb}</Typography>
    </MuiLink>
  );
}
