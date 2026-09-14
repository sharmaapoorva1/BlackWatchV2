import { Box, Stack, Typography } from "@mui/material";

export function FormSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Stack component="section" spacing={1.5}>
      <div>
        <Typography component="h2" sx={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>{label}</Typography>
        {hint && <Typography variant="caption" sx={{ display: "block", mt: 0.25, lineHeight: 1.35 }}>{hint}</Typography>}
      </div>
      {children}
    </Stack>
  );
}

export function FieldStack({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="label" sx={{ display: "block" }}>
      <Typography component="span" sx={{ display: "block", mb: 0.5, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>{label}</Typography>
      {children}
      {hint && <Typography component="span" variant="caption" sx={{ display: "block", mt: 0.5, lineHeight: 1.2 }}>{hint}</Typography>}
    </Box>
  );
}
