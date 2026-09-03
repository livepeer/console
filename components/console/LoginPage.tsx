"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LivepeerWordmark } from "@/components/design-system/LivepeerLogo";

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

interface LoginPageProps {
  /** Which mode the page renders in. Driven by route — `/login`
   *  passes `"signin"`, `/signup` passes `"signup"`. The footer
   *  toggle navigates between the two routes so the URL always matches the
   *  visible mode. */
  initialMode?: "signin" | "signup";
  /** Auth0 returnTo. MCP login uses the complete route, not /home. */
  returnTo?: string;
}

export default function LoginPage({
  initialMode = "signin",
  returnTo = "/home",
}: LoginPageProps = {}) {
  const mode = initialMode;
  const encodedReturnTo = encodeURIComponent(returnTo);
  const loginHref =
    mode === "signup"
      ? `/auth/login?screen_hint=signup&returnTo=${encodedReturnTo}`
      : `/auth/login?returnTo=${encodedReturnTo}`;
  const googleHref =
    mode === "signup"
      ? `/auth/login?screen_hint=signup&connection=google-oauth2&returnTo=${encodedReturnTo}`
      : `/auth/login?connection=google-oauth2&returnTo=${encodedReturnTo}`;

  const oauthButtonClass =
    "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-full border border-hairline bg-transparent px-4 text-[13px] font-medium text-fg-strong transition-colors hover:border-subtle hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-strong";

  return (
    <div className="flex min-h-screen flex-col bg-dark">
      <div className="flex flex-1 flex-col items-center px-6 pt-[18vh] pb-12">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[320px]"
        >
          <div className="mb-5 flex justify-center">
            <LivepeerWordmark
              className="h-6 w-auto text-fg"
              aria-label="Livepeer"
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.h1
              key={mode}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.15 }}
              className="text-balance text-center text-base font-normal leading-[1.4] tracking-tight text-fg-muted sm:text-lg"
            >
              {mode === "signin"
                ? "Log in to Livepeer Early Access"
                : "Get started with Livepeer"}
            </motion.h1>
          </AnimatePresence>

          <div className="mt-8 space-y-2">
            <a href={googleHref} className={oauthButtonClass}>
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </a>
            <a
              href={loginHref}
              className="btn-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/40"
            >
              <span>
                {mode === "signin" ? "Continue with Auth0" : "Create account"}
              </span>
            </a>
          </div>

          <p className="mt-7 text-center text-[12px] text-fg-faint">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="text-fg-strong underline decoration-fg-disabled underline-offset-2 transition-colors hover:text-fg hover:decoration-fg-strong"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-fg-strong underline decoration-fg-disabled underline-offset-2 transition-colors hover:text-fg hover:decoration-fg-strong"
                >
                  Log in
                </Link>
              </>
            )}
          </p>

          <AnimatePresence>
            {mode === "signup" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="mt-3 text-balance text-center text-[11px] leading-relaxed text-fg-disabled"
              >
                By creating an account, you agree to our{" "}
                <a
                  href="https://livepeer.org/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg-faint underline decoration-fg-disabled underline-offset-2 transition-colors hover:text-fg-strong hover:decoration-fg-faint"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="https://livepeer.org/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg-faint underline decoration-fg-disabled underline-offset-2 transition-colors hover:text-fg-strong hover:decoration-fg-faint"
                >
                  Privacy Policy
                </a>
                .
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <footer className="shrink-0 px-6 py-5">
        <div className="flex items-center justify-center gap-4 text-[11px] text-fg-disabled">
          <a
            href="https://livepeer.org/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-fg-faint"
          >
            Terms
          </a>
          <a
            href="https://livepeer.org/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-fg-faint"
          >
            Privacy
          </a>
          <a
            href="https://docs.livepeer.org"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-fg-faint"
          >
            Docs
          </a>
        </div>
      </footer>
    </div>
  );
}
