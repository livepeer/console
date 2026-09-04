"use client";

import { useRouter } from "next/navigation";
import { AuthPanel, type AuthMode } from "@/components/console/auth/AuthPanel";
import { AuthMediaRing } from "@/components/console/auth/AuthMediaRing";

interface LoginPageProps {
  mode?: AuthMode;
}

export default function LoginPage({ mode = "signin" }: LoginPageProps = {}) {
  const router = useRouter();
  const enterDashboard =
    process.env.NODE_ENV === "development"
      ? () => router.push("/home")
      : undefined;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <AuthMediaRing />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <AuthPanel mode={mode} onContinue={enterDashboard} />
      </div>
    </main>
  );
}
