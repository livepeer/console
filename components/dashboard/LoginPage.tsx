"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, type AuthProvider } from "@/components/dashboard/AuthContext";
import { LivepeerWordmark } from "@/components/icons/LivepeerLogo";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

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
  /** Which mode the page renders in. Driven by route — `/dashboard/login`
   *  passes `"signin"`, `/dashboard/signup` passes `"signup"`. The footer
   *  toggle navigates between the two routes so the URL always matches the
   *  visible mode. */
  initialMode?: "signin" | "signup";
}

export default function LoginPage({ initialMode = "signin" }: LoginPageProps = {}) {
  // Mode is owned by the route, not by local state — sibling pages
  // `/dashboard/login` and `/dashboard/signup` re-mount this component
  // with the appropriate `initialMode`. The footer toggle is a `<Link>`
  // navigation, not a `setState` call, so the URL stays in sync with the
  // visible mode and a sign-up URL can be shared.
  const mode = initialMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { connect } = useAuth();
  const router = useRouter();

  function handleEmailSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const displayName = name || email.split("@")[0] || "Demo User";
    connect({
      name: displayName,
      email: email || "demo@livepeer.org",
      initials: getInitials(displayName),
      provider: "email",
    });
    router.push("/dashboard");
  }

  function handleOAuthSubmit(provider: AuthProvider) {
    // Mock OAuth — pretend the provider returned a profile.
    const mockProfiles: Record<"github" | "google", { name: string; email: string }> = {
      github: { name: "Rick Staa", email: "rick.staa@github.com" },
      google: { name: "Rick Staa", email: "rick.staa@gmail.com" },
    };
    const profile = mockProfiles[provider as "github" | "google"];
    connect({
      name: profile.name,
      email: profile.email,
      initials: getInitials(profile.name),
      provider,
    });
    router.push("/dashboard");
  }

  // Each surface is built from a tight 3-weight hierarchy:
  //  • Wordmark — quiet brand stamp, never competes with the heading
  //  • Heading — dominant hero element, medium weight, generous tracking
  //  • Inputs/buttons — h-10 working surface tier, hairline borders, pill radius
  //  • Submit — saturated brand color (green-bright) with white text, no shadow
  // Anchored ~28% from top so it doesn't drown in the viewport.
  const inputClass =
    "h-10 w-full rounded-md border border-hairline bg-zebra px-3 text-[13px] text-fg placeholder:text-fg-disabled transition-colors hover:border-subtle hover:bg-zebra focus:border-strong focus:bg-zebra focus:outline-none";

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
          {/* Wordmark — the hero element. Stripe / Vercel pattern: brand mark dominant,
              heading reads as supporting subtitle below. */}
          <div className="mb-5 flex justify-center">
            <LivepeerWordmark
              className="h-6 w-auto text-fg"
              aria-label="Livepeer"
            />
          </div>

          {/* Heading — supporting subtitle to the wordmark above. Smaller weight,
              text-fg-muted color tier so it sits clearly below the wordmark in
              hierarchy. */}
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
                ? "Log in to the Livepeer Dashboard"
                : "Get started with Livepeer"}
            </motion.h1>
          </AnimatePresence>

          {/* OAuth — restrained pills, equal hierarchy, no Popular badge clutter */}
          <div className="mt-8 space-y-2">
            <button
              type="button"
              onClick={() => handleOAuthSubmit("github")}
              className={oauthButtonClass}
            >
              <GitHubIcon className="h-4 w-4" />
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => handleOAuthSubmit("google")}
              className={oauthButtonClass}
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>
          </div>

          {/* Divider — disciplined: hairline + tiny lowercase "or", same vertical
              gutter as section spacing so the rhythm reads "block / pause / block". */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-[11px] text-fg-faint">or</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleEmailSubmit} className="space-y-2">
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <label htmlFor="name" className="sr-only">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputClass}
            />

            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className={inputClass}
            />

            {/* Submit — theme-aware primary CTA. On dark this carries the same
                energy as the original green-bright (Linear-purple analog); on
                light it flips to neutral zinc-900 so the sign-in surface reads
                as a refined dashboard CTA, not a marketing CTA. */}
            <button
              type="submit"
              className="btn-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/40"
            >
              <span>{mode === "signin" ? "Log in with email" : "Create account"}</span>
              <kbd
                aria-hidden="true"
                className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-overlay px-1 text-[11px] font-medium leading-none text-white/85"
              >
                ↵
              </kbd>
            </button>
          </form>

          {/* Mode toggle — fine print, underline tucked tight (offset-2 not offset-4
              so it reads as part of the word, not floating below it). */}
          <p className="mt-7 text-center text-[12px] text-fg-faint">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  href="/dashboard/signup"
                  className="text-fg-strong underline decoration-fg-disabled underline-offset-2 transition-colors hover:text-fg hover:decoration-fg-strong"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/dashboard/login"
                  className="text-fg-strong underline decoration-fg-disabled underline-offset-2 transition-colors hover:text-fg hover:decoration-fg-strong"
                >
                  Log in
                </Link>
              </>
            )}
          </p>

          {/* Sign-up terms — fine print directly under the toggle, only on signup */}
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

      {/* Footer — quiet legal links pinned to the viewport bottom */}
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
