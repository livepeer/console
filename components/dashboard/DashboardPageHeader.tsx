"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthContext";

interface DashboardPageHeaderProps {
  /** Primary page title — renders as the last (current) breadcrumb. */
  title: string;
  /** Optional leading icon (lucide). Rendered to the left of the title at the
   *  same size as the breadcrumb glyph in the design. */
  icon?: LucideIcon;
  /** Optional one-line description rendered ABOVE the chrome bar in the page
   *  body when caller wants additional context. The chrome bar itself stays
   *  pure breadcrumb + actions. */
  description?: string;
  /** Optional content rendered to the right of the breadcrumbs — primary
   *  action, glance stats, controls. Kept compact (icon-buttons, sm primary). */
  actions?: ReactNode;
  /** @deprecated — chrome bar always has a hairline border-bottom. Kept for
   *  call-site backward compat. */
  bordered?: boolean;
  /** Optional className override. */
  className?: string;
}

/**
 * DashboardPageHeader — 44px chrome bar at the top of every dashboard route.
 *
 * Linear / Livepeer Console pattern: a slim breadcrumb bar with left-aligned
 * crumbs and right-aligned actions. The page title lives in the breadcrumb,
 * not as a hero. Information density comes from the *content*; this bar is
 * pure chrome and stays out of the way.
 *
 * When the user is signed out (and not already on the `/dashboard/login`
 * auth route), a `Sign in` / `Sign up` pair is appended to the right
 * actions cluster — mirrors the design prototype's `PageHead` injection
 * (`auth.authed === false && !auth.isAuthRoute`). A faint divider sits
 * between the page's own actions and the auth CTAs when both exist.
 */
export default function DashboardPageHeader({
  title,
  icon: Icon,
  description,
  actions,
  className,
}: DashboardPageHeaderProps) {
  const { isConnected, isLoading } = useAuth();
  const pathname = usePathname() ?? "";
  const isAuthRoute =
    pathname.startsWith("/dashboard/login") ||
    pathname.startsWith("/dashboard/signup");
  // Hide auth CTAs while auth state is still resolving (one frame on first
  // paint) to avoid flashing them in for connected users.
  const showAuthCTAs = !isLoading && !isConnected && !isAuthRoute;

  return (
    <div
      className={
        className ??
        "flex h-[44px] shrink-0 items-center gap-3 border-b border-hairline bg-dark px-5"
      }
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-[13px] font-medium text-fg">
        {Icon && (
          <Icon
            className="h-3.5 w-3.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        <span className="truncate" title={description}>
          {title}
        </span>
      </div>
      {(actions || showAuthCTAs) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {actions && showAuthCTAs && (
            // Spec: design's `.head-tools-sep { width:1px; height:20px;
            // background: var(--border-3); margin: 0 8px }`. We previously
            // used a too-faint `bg-hairline` (~6%) and h-4 (16px) — barely
            // visible. `bg-strong` (~18-20%) at 20px tall + 8px margin
            // matches the design and reads as a confident vertical rule.
            <span
              aria-hidden="true"
              className="mx-2 h-5 w-px bg-[color:var(--color-border-strong)]"
            />
          )}
          {showAuthCTAs && (
            <>
              <Link
                href="/dashboard/login"
                className="inline-flex h-[26px] items-center rounded-[4px] px-2.5 text-[12.5px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
              >
                Sign in
              </Link>
              <Link
                href="/dashboard/signup"
                className="btn-primary inline-flex h-[26px] items-center rounded-[4px] px-2.5 text-[12.5px] font-medium transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
