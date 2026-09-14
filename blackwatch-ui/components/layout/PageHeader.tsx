import { Box, Stack, Typography } from "@mui/material";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

// Page-level header. MUI owns the responsive stacking so actions never force
// a narrow page wider than its viewport.
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return (
    <Box component="header" sx={{ mb: 3, display: "flex", minWidth: 0, flexDirection: { xs: "column", md: "row" }, alignItems: { md: "flex-end" }, justifyContent: "space-between", gap: { xs: 1.5, md: 2 } }}>
      <Box sx={{ minWidth: 0 }}>
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <Typography component="h1" variant="h1" sx={{ overflowWrap: "anywhere" }}>{title}</Typography>
        {subtitle && <Typography variant="body2" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {actions && <Stack direction="row" useFlexGap spacing={1} sx={{ flexShrink: 0, flexWrap: "wrap" }}>{actions}</Stack>}
    </Box>
  );
}
