"use client";

import Link from "next/link";
import {
  ArrowRight,
  House,
  Activity,
  BarChart3,
  Box,
  Globe,
  Key,
  type LucideIcon,
} from "lucide-react";
import { AUTH_SIGNIN_HREF, AUTH_SIGNUP_HREF } from "@/lib/console/auth-login";

/**
 * SignInWall — what a logged-out user sees when they hit a private organization
 * route (Home / Jobs / Usage / API keys / Network). Mirrors the
 * Livepeer Dashboard v4 prototype's `wall-shell` block: route-aware icon +
 * eyebrow + title + description, "Sign in" / "Create organization" CTAs, and an
 * `→ Explore apps` escape hatch. The sidebar around it stays in its
 * logged-out variant so the user keeps their bearings; only the main pane
 * swaps to this block.
 *
 * Copy is intentionally specific per route — the prototype's view was that a
 * generic "please sign in" page is the wrong move, because it doesn't tell
 * the user *why* this route is organization-only. Each route names the organization
 * concern (job history, usage limits, keys, etc.) so the sign-in ask feels
 * like a continuation of intent rather than a generic gate.
 */

export type SignInWallRoute =
  | "home"
  | "apps"
  | "calls"
  | "usage"
  | "keys"
  | "network";

interface RouteCopy {
  icon: LucideIcon;
  title: string;
  description: string;
}

const ROUTE_COPY: Record<SignInWallRoute, RouteCopy> = {
  home: {
    icon: House,
    title: "Sign in to your organization",
    description:
      "Your console, activity, usage, and keys live in your organization. Sign in to pick up where you left off.",
  },
  apps: {
    icon: Box,
    title: "Apps are organization-only",
    description:
      "Your deployed pipelines live in your organization, scoped per environment. Sign in to manage them — or explore apps without an account.",
  },
  calls: {
    icon: Activity,
    title: "Calls are organization-only",
    description:
      "Every call your organization makes — batch and live — is recorded here. Sign in to see them, or try an app without an account.",
  },
  usage: {
    icon: BarChart3,
    title: "Usage is organization-only",
    description:
      "Track activity, spend, and limits against your free tier. Sign in to view, or skip the organization and explore apps.",
  },
  keys: {
    icon: Key,
    title: "Sign in to manage API keys",
    description:
      "API keys are scoped to an organization. Create, rotate, and revoke keys after signing in.",
  },
  network: {
    icon: Globe,
    title: "Network metrics — sign in",
    description:
      "Your network performance view is per-organization. Sign in to see GPU pool health and routing.",
  },
};

export default function SignInWall({ route }: { route: SignInWallRoute }) {
  const { icon: Icon, title, description } = ROUTE_COPY[route];

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <div className="mx-auto flex w-full max-w-[480px] flex-col items-center px-7 pt-20 pb-20 text-center">
        {/* Icon tile — 48×48 rounded square, dim icon */}
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-md border border-hairline bg-dark-card text-fg-muted">
          <Icon
            className="h-[22px] w-[22px]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>

        {/* Mono uppercase eyebrow — "ORGANIZATION · PRIVATE" */}
        <p className="mb-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-fg-disabled">
          Organization · Private
        </p>

        {/* Title — large, tight tracking */}
        <h1 className="mb-3 max-w-[28ch] text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-fg text-balance">
          {title}
        </h1>

        {/* Description — fg-muted, ~36ch wrap */}
        <p className="mb-6 max-w-[36ch] text-[14px] leading-[1.55] text-fg-muted">
          {description}
        </p>

        {/* CTA pair — theme-aware primary Sign in + bordered Create organization */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <a
            href={AUTH_SIGNIN_HREF}
            className="btn-primary inline-flex h-9 min-w-[140px] items-center justify-center gap-1.5 rounded-[6px] px-4 text-[13px] font-medium transition-colors"
          >
            Sign in
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <a
            href={AUTH_SIGNUP_HREF}
            className="btn-outline inline-flex h-9 items-center justify-center rounded-[6px] px-4 text-[13px] transition-colors"
          >
            Create organization
          </a>
        </div>

        {/* Divider — "or browse without an account" with hairline rules */}
        <div
          className="mb-3 flex w-full items-center gap-3 text-[11px] uppercase tracking-[0.06em] text-fg-disabled"
          aria-hidden="true"
        >
          <span className="h-px flex-1 bg-tint" />
          <span className="font-mono">or browse without an account</span>
          <span className="h-px flex-1 bg-tint" />
        </div>

        {/* Escape hatch — Explore apps */}
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-fg"
        >
          Explore apps
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
