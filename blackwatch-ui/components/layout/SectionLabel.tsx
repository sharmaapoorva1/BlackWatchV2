import Typography from "@mui/material/Typography";

// Small uppercase label above tables / panels.
// Spec: 11px, uppercase, letter-spacing 0.08em, tertiary text color.
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Typography component="h2" className={className} sx={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
      {children}
    </Typography>
  );
}
