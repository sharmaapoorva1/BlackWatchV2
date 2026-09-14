import Paper from "@mui/material/Paper";

// The bordered/tinted section every table sits inside. Overflow belongs on
// the panel itself so layout classes such as `grid`, `flex`, and `p-*` apply
// to the actual content instead of an invisible wrapper.
export function DataPanel({
  children,
  className,
  scrollX = false,
}: {
  children: React.ReactNode;
  className?: string;
  scrollX?: boolean;
}) {
  return (
    <Paper component="section" className={className} sx={{ minWidth: 0, maxWidth: "100%", border: 1, borderColor: "divider", bgcolor: "background.paper", overflowX: scrollX ? "auto" : "visible" }}>
      {children}
    </Paper>
  );
}
