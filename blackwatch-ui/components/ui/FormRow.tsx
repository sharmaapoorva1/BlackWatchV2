import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
} from "react";
import { Box, FormHelperText, FormLabel, Typography } from "@mui/material";

export function FormRow({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const generatedId = useId();
  const child =
    Children.count(children) === 1 && isValidElement(children)
      ? (children as ReactElement<{
          id?: string;
          "aria-invalid"?: boolean;
          "aria-describedby"?: string;
        }>)
      : undefined;
  const controlId = child?.props.id ?? generatedId;
  const control =
    child
      ? cloneElement(child, {
          id: controlId,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? `${controlId}-error` : undefined,
        })
      : children;

  return (
    <Box sx={{ display: "grid", minWidth: 0, gridTemplateColumns: { xs: "1fr", sm: "minmax(140px,200px) minmax(0,1fr)" }, alignItems: "start", gap: { xs: 1, sm: 2 }, borderBottom: 1, borderColor: "divider", px: 2, py: 1.5, "&:last-child": { borderBottom: 0 } }}>
      <FormLabel htmlFor={Children.count(children) === 1 ? controlId : undefined} sx={{ pt: 0.5, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "text.secondary" }}>
        {label}
        {hint && <Typography component="span" variant="caption" sx={{ ml: 1, textTransform: "none", letterSpacing: "normal" }}>{hint}</Typography>}
      </FormLabel>
      <Box sx={{ minWidth: 0 }}>
        {control}
        {error && <FormHelperText id={`${controlId}-error`} role="alert" error sx={{ mt: 0.5 }}>{error}</FormHelperText>}
      </Box>
    </Box>
  );
}
