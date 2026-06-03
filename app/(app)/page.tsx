"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/dashboard/AuthContext";
import ExploreView from "@/components/dashboard/ExploreView";

// Root `/`:
//   - signed in  → redirect to /home (the dashboard default)
//   - signed out → the Explore catalog stays here as the public landing
// (Logged-in users still reach Explore via the sidebar, which points to
// /explore — that route doesn't redirect.)
export default function RootPage() {
  const { isConnected, isLoading, user } = useAuth();
  const router = useRouter();

  const signedIn = isConnected && !!user;

  useEffect(() => {
    if (!isLoading && signedIn) router.replace("/home");
  }, [isLoading, signedIn, router]);

  // Hold a frame while auth hydrates, and while redirecting signed-in users, so
  // they never flash the Explore catalog before landing on /home.
  if (isLoading || signedIn) return null;

  return <ExploreView />;
}
