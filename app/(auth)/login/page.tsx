"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/console/AuthContext";
import LoginPage from "@/components/console/LoginPage";

export default function LoginRoute() {
  const { isConnected } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.replace("/home");
    }
  }, [isConnected, router]);

  if (isConnected) return null;

  return <LoginPage />;
}
