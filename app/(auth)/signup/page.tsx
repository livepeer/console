"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/dashboard/AuthContext";
import LoginPage from "@/components/dashboard/LoginPage";

/**
 * Signup route — sibling of `/login`. Renders the same
 * `LoginPage` component but seeds it with `initialMode="signup"`. The
 * footer toggle inside the page is a `<Link>` to `/login`, so
 * URL and visible mode stay in sync without query-param trickery.
 */
export default function SignupRoute() {
  const { isConnected } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.replace("/home");
    }
  }, [isConnected, router]);

  if (isConnected) return null;

  return <LoginPage initialMode="signup" />;
}
