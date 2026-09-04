"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { LivepeerLockup } from "@/components/design-system/LivepeerLogo";

export type AuthMode = "signin" | "signup";

const COPY = {
  signin: {
    submit: "Sign in",
    google: "Sign in with Google",
    footer: "Don't have an account?",
    footerAction: "Sign up",
    footerHref: "/signup",
  },
  signup: {
    submit: "Sign up",
    google: "Sign up with Google",
    footer: "Already have an account?",
    footerAction: "Log in",
    footerHref: "/login",
  },
} as const;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthPanel({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode];
  const providerButtonClass =
    "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-sm border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";
  const primaryButtonClass =
    "inline-flex h-11 w-full items-center justify-center rounded-sm bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";
  const inputClass =
    "h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground";

  function keepPreviewLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[420px] overflow-hidden rounded-sm bg-background shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground)_8%,transparent)]"
      aria-label={mode === "signin" ? "Sign in" : "Sign up"}
    >
      <div className="px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex justify-center py-5">
          <LivepeerLockup className="h-auto w-[184px] text-foreground" />
        </div>
        <form className="mt-7 space-y-3" onSubmit={keepPreviewLocal}>
          <label className="block">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              className={inputClass}
              placeholder="Email address"
            />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <input
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className={inputClass}
              placeholder="Password"
            />
          </label>
          <button type="submit" className={primaryButtonClass}>
            {copy.submit}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <button type="button" className={providerButtonClass}>
          <GoogleIcon className="h-4 w-4" />
          {copy.google}
        </button>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {copy.footer}{" "}
          <Link
            href={copy.footerHref}
            className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
          >
            {copy.footerAction}
          </Link>
        </p>
      </div>
    </motion.section>
  );
}
