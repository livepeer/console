"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/dashboard/AuthContext";
import LoginPage from "@/components/dashboard/LoginPage";

function LoginRouteInner() {
  const { isConnected } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceFlow = searchParams.get("flow") === "device";

  useEffect(() => {
    if (isConnected && !deviceFlow) {
      router.replace("/home");
    }
  }, [isConnected, deviceFlow, router]);

  if (isConnected && !deviceFlow) return null;

  return <LoginPage />;
}

export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <LoginRouteInner />
    </Suspense>
  );
}
