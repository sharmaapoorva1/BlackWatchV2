import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Box, Link as MuiLink } from "@mui/material";

export function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <MuiLink
        component={Link}
        href={href}
        underline="hover"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: 12, color: "text.secondary" }}
      >
        <ArrowLeft size={12} /> {label}
      </MuiLink>
    </Box>
  );
}
