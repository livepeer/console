"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/dashboard/AuthContext";
import LoginPage from "@/components/dashboard/LoginPage";

function SignupRouteInner() {
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

export default function SignupRoute() {
  return (
    <Suspense fallback={null}>
      <SignupRouteInner />
    </Suspense>
  );
}
