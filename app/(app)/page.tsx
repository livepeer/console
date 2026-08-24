"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/console/AuthContext";

// Root `/`:
//   - signed in  → redirect to /home (the console default)
//   - signed out → redirect to /login (the console default entry point)
// Explore is still reachable at /explore for anyone who lands there directly;
// it just isn't the default landing any more.
export default function RootPage() {
  const { isConnected, isLoading, user } = useAuth();
  const router = useRouter();

  const signedIn = isConnected && !!user;

  useEffect(() => {
    if (isLoading) return;
    router.replace(signedIn ? "/home" : "/login");
  }, [isLoading, signedIn, router]);

  // Nothing renders here — `/` is a pure redirect in both auth states.
  return null;
}
