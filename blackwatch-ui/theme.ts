const canvas = "#0A0B0F";
const surface = "#101218";
const elevated = "#181B22";
const foreground = "#E4E4E7";
const muted = "#9CA3AF";
const subtle = "#6B7280";
const signal = "#48D4E8";

/** Shared design tokens. Rendering is owned by the Aceternity/Tailwind layer. */
export const appTheme = {
  palette: {
    mode: "dark",
    background: { default: canvas, paper: surface },
    text: { primary: foreground, secondary: muted, disabled: "#4B5563" },
    divider: "rgba(255, 255, 255, 0.12)",
    primary: { main: signal, contrastText: canvas },
    secondary: { main: muted, contrastText: canvas },
    error: { main: "#F43F5E" }, warning: { main: "#FB923C" }, info: { main: "#60A5FA" }, success: { main: "#34D399" },
    signal: { main: signal, light: "#8DECF5", dark: "#1597AA", contrastText: canvas },
    severity: { critical: "#F43F5E", high: "#FB923C", medium: "#FACC15", low: "#60A5FA", resolved: "#34D399" },
  },
  typography: { fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif', fontSize: 14 },
  breakpoints: { values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1536 } },
} as const;

export { canvas, surface, elevated, foreground, muted, subtle, signal };
