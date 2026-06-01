"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/dashboard/AuthContext";
import { UserSessionProvider } from "@/components/dashboard/UserSessionContext";

/**
 * Shared client providers for auth + PymtHouse user signing session.
 * Used by both `(app)` and `(auth)` layouts so a short-lived signing token
 * is minted as soon as the user session is restored or created.
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UserSessionProvider>{children}</UserSessionProvider>
    </AuthProvider>
  );
}
