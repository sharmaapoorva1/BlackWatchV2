import { createTheme, type PaletteColor } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    signal: PaletteColor;
    severity: {
      critical: string;
      high: string;
      medium: string;
      low: string;
      resolved: string;
    };
  }

  interface PaletteOptions {
    signal?: PaletteColor;
    severity?: {
      critical?: string;
      high?: string;
      medium?: string;
      low?: string;
      resolved?: string;
    };
  }
}

const canvas = "#0A0B0F";
const surface = "#101218";
const elevated = "#181B22";
const foreground = "#E4E4E7";
const muted = "#9CA3AF";
const subtle = "#6B7280";
const signal = "#48D4E8";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: canvas,
      paper: surface,
    },
    text: {
      primary: foreground,
      secondary: muted,
      disabled: "#4B5563",
    },
    divider: "rgba(255, 255, 255, 0.12)",
    primary: {
      main: signal,
      contrastText: canvas,
    },
    secondary: {
      main: muted,
      contrastText: canvas,
    },
    error: {
      main: "#F43F5E",
    },
    warning: {
      main: "#FB923C",
    },
    info: {
      main: "#60A5FA",
    },
    success: {
      main: "#34D399",
    },
    signal: {
      main: signal,
      light: "#8DECF5",
      dark: "#1597AA",
      contrastText: canvas,
    },
    severity: {
      critical: "#F43F5E",
      high: "#FB923C",
      medium: "#FACC15",
      low: "#60A5FA",
      resolved: "#34D399",
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    h1: { fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.35rem", fontWeight: 600, letterSpacing: "-0.015em" },
    h3: { fontSize: "1.1rem", fontWeight: 600 },
    body2: { color: muted },
    caption: { color: subtle, letterSpacing: "0.04em" },
    button: { fontWeight: 600, textTransform: "none" },
    overline: { fontSize: "0.65rem", letterSpacing: "0.12em", fontWeight: 600 },
  },
  spacing: 4,
  shape: {
    borderRadius: 2,
  },
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*, *::before, *::after": { boxSizing: "border-box" },
        html: { height: "100%", backgroundColor: canvas },
        body: {
          minHeight: "100%",
          margin: 0,
          backgroundColor: canvas,
          color: foreground,
          colorScheme: "dark",
          fontVariantNumeric: "tabular-nums",
          WebkitFontSmoothing: "antialiased",
          textRendering: "optimizeLegibility",
        },
        "button, a, input, select, textarea": { touchAction: "manipulation" },
        "::selection": { backgroundColor: signal, color: canvas },
        ":focus-visible": { outline: `2px solid ${signal}`, outlineOffset: 2 },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            scrollBehavior: "auto !important",
            transitionDuration: "0.01ms !important",
          },
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: canvas,
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          backgroundImage: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: surface,
          backgroundImage: "none",
          borderRight: "1px solid rgba(255, 255, 255, 0.12)",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 36, borderRadius: 2 },
        contained: {
          "&.MuiButton-containedPrimary": { color: canvas },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small", variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: surface,
          borderRadius: 2,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.12)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: signal,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: signal,
            borderWidth: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: muted } },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 2, fontWeight: 600 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          padding: "10px 12px",
        },
        head: {
          backgroundColor: elevated,
          color: muted,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 100ms ease",
          "&:hover": { backgroundColor: "rgba(72, 212, 232, 0.06)" },
        },
      },
    },
  },
});

export { canvas, surface, elevated, foreground, muted, subtle, signal };
