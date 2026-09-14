"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { appTheme } from "@/theme";

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
