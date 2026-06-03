"use client";

import AppsView from "@/components/dashboard/AppsView";
import SignInWall from "@/components/dashboard/SignInWall";
import { useAuth } from "@/components/dashboard/AuthContext";

export default function AppsPage() {
  const { isConnected, isLoading } = useAuth();

  if (isLoading) return null;

  // Organization-only — logged-out users see the sign-in wall instead of the
  // apps list.
  if (!isConnected) return <SignInWall route="apps" />;

  return <AppsView />;
}
