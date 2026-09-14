"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Menu as MenuIcon, Settings as SettingsIcon, X } from "lucide-react";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";

import { LiveCounter } from "./LiveCounter";
import { logoutAction } from "@/app/login/actions";
import { useAuth } from "@/components/auth/AuthProvider";

// Top navigation. On mobile the hamburger toggles the SideNav drawer; on
// desktop it's hidden. The account pill opens a small popover with a
// Sign out action; the Settings icon jumps to /settings.
export function TopNav({
  onMenuClick,
  menuOpen = false,
}: {
  onMenuClick?: () => void;
  menuOpen?: boolean;
}) {
  return (
    <AppBar position="static">
      <Toolbar variant="dense" sx={{ minHeight: 48, px: { xs: 1.5, md: 2 } }}>
        <IconButton
          color="inherit"
          onClick={onMenuClick}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          sx={{ display: { md: "none" }, mr: 1, color: "text.secondary" }}
        >
          {menuOpen ? <X size={16} /> : <MenuIcon size={16} />}
        </IconButton>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Logo />
        <Typography
          component="span"
          variant="caption"
          sx={{ display: { xs: "none", sm: "inline" }, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.18em" }}
        >
          blackwatch
        </Typography>
      </Box>

      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: { xs: 1, md: 2 } }}>
        <LiveCounter />
        <IconButton component={Link} href="/settings" aria-label="Settings" size="small" sx={{ color: "text.secondary" }}>
          <SettingsIcon size={15} strokeWidth={1.5} />
        </IconButton>
        <AccountMenu />
      </Box>
      </Toolbar>
    </AppBar>
  );
}

function Logo() {
  return (
    <Box aria-hidden sx={{ display: "grid", placeItems: "center", width: 20, height: 20, border: 1, borderColor: "signal.main", color: "signal.main" }}>
      <Typography component="span" sx={{ fontFamily: "monospace", fontSize: 9, fontWeight: 500, lineHeight: 1 }}>BW</Typography>
    </Box>
  );
}

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const { user, role, loading } = useAuth();
  const initials = (user ?? "??").slice(0, 2).toUpperCase();
  const isViewer = !loading && role === "viewer";
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {isViewer && (
        <Chip label="viewer" size="small" variant="outlined" title="Read-only role — mutations disabled" sx={{ display: { xs: "none", sm: "inline-flex" }, fontFamily: "monospace", fontSize: 9, textTransform: "uppercase" }} />
      )}
      <IconButton
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={openMenu ? "true" : undefined}
        size="small"
        sx={{ p: 0 }}
      >
        <Avatar sx={{ width: 26, height: 26, borderRadius: 1, bgcolor: "background.paper", border: 1, borderColor: "divider", color: "text.secondary", fontFamily: "monospace", fontSize: 10 }}>
          {initials}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 210, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" noWrap color="text.primary">{user ?? "unknown"}</Typography>
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{loading ? "…" : role}</Typography>
        </Box>
        <Divider />
        <MenuItem component={Link} href="/settings" onClick={() => setAnchorEl(null)}>
          <ListItemIcon><SettingsIcon size={15} /></ListItemIcon>
          Settings
        </MenuItem>
        <Box component="form" action={logoutAction}>
          <MenuItem component="button" type="submit" onClick={() => setAnchorEl(null)} sx={{ width: "100%" }}>
            <ListItemIcon><LogOut size={15} /></ListItemIcon>
            Sign out
          </MenuItem>
        </Box>
      </Menu>
    </Box>
  );
}
