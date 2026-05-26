"use client";

import KeysView from "@/components/dashboard/KeysView";
import SignInWall from "@/components/dashboard/SignInWall";
import { useAuth } from "@/components/dashboard/AuthContext";

// Note: the previous server-component metadata moves out with the auth gate.
// Title/description for /dashboard/keys now come from the layout's defaults.

export default function KeysPage() {
  const { isConnected, isLoading } = useAuth();

  if (isLoading) return null;

  // Workspace-only — logged-out users see the route-specific sign-in wall
  // ("API keys are scoped to a workspace…") instead of the keys table.
  if (!isConnected) return <SignInWall route="keys" />;

  return <KeysView />;
}
