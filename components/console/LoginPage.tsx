"use client";

import { AuthPanel, type AuthMode } from "@/components/console/auth/AuthPanel";
import { AuthMediaRing } from "@/components/console/auth/AuthMediaRing";

interface LoginPageProps {
  mode?: AuthMode;
  returnTo?: string;
}

export default function LoginPage({
  mode = "signin",
  returnTo = "/home",
}: LoginPageProps) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <AuthMediaRing />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <AuthPanel mode={mode} returnTo={returnTo} />
      </div>
    </main>
  );
}
