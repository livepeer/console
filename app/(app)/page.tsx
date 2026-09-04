"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/console/AuthContext";
import { AUTH_SIGNIN_HREF } from "@/lib/console/auth-login";

// Root `/`:
//   - signed in  → redirect to /home (the console default)
//   - signed out → Auth0 Universal Login
export default function RootPage() {
  const { isConnected, isLoading, user } = useAuth();

  const signedIn = isConnected && !!user;

  useEffect(() => {
    if (isLoading) return;
    if (signedIn) {
      window.location.replace("/home");
      return;
    }
    window.location.replace(AUTH_SIGNIN_HREF);
  }, [isLoading, signedIn]);

  return null;
}
