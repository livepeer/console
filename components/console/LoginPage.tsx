"use client";

import { AuthPanel, type AuthMode } from "@/components/console/auth/AuthPanel";
import { AuthMediaRing } from "@/components/console/auth/AuthMediaRing";

interface LoginPageProps {
  mode?: AuthMode;
}

export default function LoginPage({ mode = "signin" }: LoginPageProps = {}) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <AuthMediaRing />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <AuthPanel mode={mode} />
      </div>
    </main>
  );
}
