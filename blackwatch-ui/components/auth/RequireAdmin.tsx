"use client";

// Render children only if the current user's role === 'admin'.
// Wrap every mutation button / form / edit-delete control with this.
// Backend enforces the actual gate; this just hides UI a viewer can't use.

import { useAuth } from "./AuthProvider";

export function RequireAdmin({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { role, loading } = useAuth();
  // Keep the control surface stable while /api/whoami hydrates. The backend
  // remains the authority, and pointer-events prevents a premature click.
  if (loading) {
    return (
      <span className="contents pointer-events-none opacity-60" aria-busy="true">
        {children}
      </span>
    );
  }
  if (role !== "admin") return <>{fallback}</>;
  return <>{children}</>;
}
