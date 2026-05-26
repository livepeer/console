"use client";

import JobsView from "@/components/dashboard/JobsView";
import SignInWall from "@/components/dashboard/SignInWall";
import { useAuth } from "@/components/dashboard/AuthContext";

// Note: page metadata isn't valid in client components, so the previous
// `metadata` export moves out alongside this auth gate. Title/description for
// the jobs route now come from the parent layout's defaults; if we want
// per-route SEO back, we'll need to split the wall + content into a server
// component shell that owns metadata and a client component that owns auth.

export default function JobsPage() {
  const { isConnected, isLoading } = useAuth();

  // Avoid flashing either state while auth hydrates from localStorage.
  if (isLoading) return null;

  // Workspace-only route — logged-out users see the route-specific sign-in
  // wall ("Jobs are workspace-only") instead of an empty list.
  if (!isConnected) return <SignInWall route="jobs" />;

  return <JobsView />;
}
