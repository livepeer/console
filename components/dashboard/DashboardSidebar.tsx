"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  LayoutGrid,
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Box,
  ChevronLeft,
  CreditCard,
  ExternalLink,
  Globe,
  Key,
  Lock,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  Terminal,
  User as UserIcon,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { LivepeerWordmark, LivepeerSymbol } from "@/components/design-system/LivepeerLogo";
import { PORTAL_NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/components/dashboard/AuthContext";
import Drawer from "@/components/design-system/Drawer";
import NavLink from "@/components/dashboard/NavLink";
import StatusDot from "@/components/dashboard/StatusDot";
import SidebarUsageCard from "@/components/dashboard/SidebarUsageCard";
import OrganizationMenu from "@/components/dashboard/OrganizationMenu";
import Tooltip from "@/components/design-system/Tooltip";
import { APPS, SETTINGS_API_KEYS, PIPELINES } from "@/lib/dashboard/mock-data";
import { formatRuns } from "@/lib/dashboard/utils";

const NAV_ICONS = {
  House,
  LayoutGrid,
  Activity,
  BarChart3,
  Globe,
  Key,
  Box,
  Settings: SettingsIcon,
} as const;

const COLLAPSED_KEY = "dashboard.sidebar.collapsed";

function getNavActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/home") return pathname === "/home";
  if (itemHref === "/") {
    return pathname === "/";
  }
  // Tab-deep links inherit active state from path only — Settings page tabs
  // already mark the current sub-tab visually inside their own TabStrip.
  if (itemHref.includes("?")) {
    const path = itemHref.split("?")[0];
    return pathname.startsWith(path);
  }
  return pathname.startsWith(itemHref);
}

// ─── Sidebar content (shared between desktop + mobile drawer) ───────────────

interface SidebarContentProps {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  /** Called when a nav item is clicked — used to close mobile drawer. */
  onNavigate?: () => void;
  /** Hides the collapse toggle (used inside the mobile drawer). */
  hideToggle?: boolean;
}

// ─── Logged-out sidebar variant ─────────────────────────────────────────────
//
// Mirrors the Livepeer Dashboard v4 prototype's `loggedOut` Sidebar (see
// `components.jsx`, the `if (loggedOut)` branch). Order top → bottom:
//
//   1. Brand row — wordmark links to / (no organization switcher)
//   2. Search button (Cmd-K, same as signed-in variant)
//   3. Public nav — Explore (count), Docs (external)
//   4. ORGANIZATION eyebrow + locked nav: Home, Runs, Usage, API keys
//   5. Spacer
//   6. Free-tier promo card — "Get an API key" + "Sign in"
//   7. Footer — Network nav, status row
//
// Locked items still navigate to their real routes; those routes render a
// `SignInWall` instead of their content so the sidebar stays put. The promo
// card replaces the SidebarUsageCard since there's no organization usage to
// show; per the prototype the eyebrow is "Free tier" and the body sells the
// 5-demo-runs hook with a single primary CTA.

function SignedOutSidebarContent({
  collapsed,
  padX,
  onToggleCollapsed,
  hideToggle,
  onNavigate,
}: {
  collapsed: boolean;
  padX: string;
  onToggleCollapsed?: () => void;
  hideToggle: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const exploreActive =
    pathname === "/";

  return (
    <div className="flex h-full flex-col bg-shell">
      {/* Brand row — wordmark links to / (the public landing) */}
      <div
        className={`flex shrink-0 items-center pt-2 pb-2 ${padX} ${collapsed ? "flex-col gap-2.5" : "gap-1"}`}
      >
        <Link
          href="/"
          aria-label="Livepeer Dashboard — explore apps"
          className={
            collapsed
              ? "flex h-[26px] w-[26px] items-center justify-center"
              : "flex min-w-0 flex-1 items-center px-1.5"
          }
          onClick={onNavigate}
        >
          {collapsed ? (
            <LivepeerSymbol className="h-5 w-5 text-fg" aria-hidden="true" />
          ) : (
            <LivepeerWordmark
              className="h-3.5 w-auto text-fg"
              aria-hidden="true"
            />
          )}
        </Link>

        {!hideToggle && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[4px] text-fg-faint transition-colors hover:bg-hover hover:text-fg"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Search button — same Cmd-K dispatch as the signed-in variant; copy
          tweaked to "Search apps…" since there's no organization to jump
          across. */}
      <div className={`shrink-0 pb-2 ${padX}`}>
        {collapsed ? (
          <button
            type="button"
            aria-label="Search"
            onClick={() => {
              const isMac =
                typeof navigator !== "undefined" &&
                navigator.platform.toUpperCase().includes("MAC");
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  [isMac ? "metaKey" : "ctrlKey"]: true,
                }),
              );
            }}
            className="mx-auto flex h-[26px] w-[26px] items-center justify-center rounded-[4px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const isMac =
                typeof navigator !== "undefined" &&
                navigator.platform.toUpperCase().includes("MAC");
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  [isMac ? "metaKey" : "ctrlKey"]: true,
                }),
              );
            }}
            className="flex w-full items-center gap-2 rounded-[8px] border border-hairline bg-dark-lighter px-2.5 py-1.5 text-[12.5px] text-fg-faint transition-colors hover:border-subtle hover:text-fg-strong"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="flex-1 text-left">Search</span>
            <kbd className="font-mono text-[10.5px] tracking-wider text-fg-faint">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Public nav — Explore + Stats + Docs */}
      <nav aria-label="Public navigation" className={`pb-2 ${padX}`}>
        <ul className="space-y-px">
          <li>
            <NavLink
              href="/"
              icon={LayoutGrid}
              label="Explore"
              active={exploreActive}
              collapsed={collapsed}
              meta={collapsed ? undefined : formatRuns(APPS.length)}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavLink
              href="/network"
              icon={Globe}
              label="Stats"
              active={pathname.startsWith("/network")}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </li>
          <li>
            <NavLink
              href="https://docs.livepeer.org"
              icon={BookOpen}
              label="Docs"
              collapsed={collapsed}
              external
              onNavigate={onNavigate}
            />
          </li>
        </ul>
      </nav>

      {/* (The locked-Organization nav block previously rendered here — Home /
          Jobs / Usage / API keys with lock icons — has been removed. Logged-
          out users now go straight from public nav to the Free-tier promo.
          Discovery of those routes happens through the promo's "Get an API
          key" CTA + the sign-in walls that gate the routes themselves, not
          through teaser entries in the rail.) */}

      {/* Spacer pushes promo + footer to the bottom */}
      <div className="flex-1" />

      {/* Free-tier promo card — design spec `.side-promo` (yLXs… export).
       *  - 14/14/12 asymmetric padding (a touch more breathing room at top)
       *  - Radial glow anchored TOP-RIGHT using `--lp-soft` (green at 18%
       *    alpha) at 70% opacity — gives the card a soft brand tint that
       *    reads as "you can light this up by signing up"
       *  - Eyebrow uses `--lp-bright` (green-bright) for accent identity
       *  - Sub text is `--fg-4` (50% in dark) — dimmer than helper text
       *  - Sign-in link is `--fg-3` (65%), font-medium with hover tint
       *  Hidden when sidebar is collapsed (no useful 26px representation). */}
      {!collapsed && (
        <div className={`shrink-0 ${padX} pb-2`}>
          <div className="relative overflow-hidden rounded-md border border-subtle bg-sidebar-card-bg pt-[14px] pr-[14px] pb-[12px] pl-[14px]">
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(120% 80% at 100% 0%, var(--color-green-subtle), transparent 60%)",
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <p className="mb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-green-bright">
                Free tier
              </p>
              <p className="mb-1.5 text-[14.5px] font-semibold leading-[1.25] tracking-[-0.01em] text-fg">
                5 demo calls
                <br />
                per app
              </p>
              <p className="mb-2.5 text-[11.5px] leading-[1.45] text-fg-faint">
                No credit card. Spin up in 30 seconds with an API key.
              </p>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    router.push("/signup");
                    onNavigate?.();
                  }}
                  className="btn-primary flex h-7 w-full items-center justify-center rounded-[4px] px-2.5 text-[12.5px] font-medium tracking-[-0.005em] transition-colors"
                >
                  Get an API key
                </button>
                <button
                  type="button"
                  onClick={() => {
                    router.push("/login");
                    onNavigate?.();
                  }}
                  className="flex h-[26px] w-full items-center justify-center rounded-[4px] text-[12px] font-medium tracking-[-0.005em] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status row. (Explore / Stats / Docs live in the public nav above.) */}
      <div className={`shrink-0 border-t border-hairline ${padX} py-2`}>
        {collapsed ? (
          // Tooltip's inline-flex wrapper would left-align the link inside
          // the padded `<div>` parent. Centering wrapper here matches the
          // recipe used inside `NavLink` for the same reason.
          <div className="flex justify-center">
            <Tooltip content="All services operational" side="right">
              <a
                href="https://status.livepeer.org"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Status: all services operational (opens in new tab)"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] transition-colors hover:bg-hover"
              >
                <StatusDot tone="green" size="md" />
              </a>
            </Tooltip>
          </div>
        ) : (
          <a
            href="https://status.livepeer.org"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Status: all services operational (opens in new tab)"
            className="flex h-7 w-full items-center gap-2 rounded-md px-2 font-mono text-[11px] tracking-[0.02em] text-fg-faint transition-colors hover:bg-zebra hover:text-fg-muted"
          >
            <StatusDot tone="green" />
            <span className="min-w-0 flex-1 truncate">All systems operational</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-fg-disabled" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Settings rail ──────────────────────────────────────────────────────────
//
// Renders inline inside the signed-in `SidebarContent` when the user is on a
// `/settings*` route. Per the v6 prototype's `SettingsRail` (see
// `components.jsx`): a back-arrow header that returns to `/home`,
// followed by a `Organization` group (General / Members / Billing / Limits) and
// an `Account` group (Profile / Notifications / Security). The organization
// switcher and search above stay put; the usage strip and footer below stay
// put — only the main nav block + Pinned section swap to this rail.
//
// Active item is determined by `?tab=<id>` on the current path. Items whose
// content isn't built yet still navigate (the route renders the closest
// existing tab) so the rail's behavior is correct end-to-end.

const SETTINGS_RAIL_GROUPS: {
  group: string;
  items: { id: string; label: string; icon: LucideIcon; meta?: string }[];
}[] = [
  {
    group: "Organization",
    items: [
      { id: "organization", label: "General", icon: Box },
      { id: "members", label: "Members", icon: UsersIcon, meta: "4" },
      { id: "billing", label: "Billing", icon: CreditCard },
      { id: "usage-limits", label: "Limits", icon: BarChart3 },
      { id: "deploy-tokens", label: "Deploy tokens", icon: Terminal },
    ],
  },
  {
    group: "Account",
    items: [
      { id: "profile", label: "Profile", icon: UserIcon },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "security", label: "Security", icon: Lock },
      { id: "appearance", label: "Appearance", icon: Palette },
    ],
  },
];

function SettingsRail({
  pathname,
  padX,
  onNavigate,
}: {
  pathname: string;
  padX: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  // Read the active sub-tab from `?tab=<id>` on the current URL. Default to
  // "organization" when on `/settings` with no tab param — matches the
  // prototype's fallback (`route === 'settings' ? 'organization' : ...`).
  let activeTab = "organization";
  if (pathname === "/settings" || pathname.startsWith("/settings")) {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const t = params.get("tab");
    if (t) activeTab = t;
  }

  return (
    <div className={`flex flex-col ${padX}`}>
      {/* Back arrow + "Settings" header — returns to /home, mirroring
          the prototype's `setRoute('home')` on the back button. */}
      <button
        type="button"
        onClick={() => {
          router.push("/home");
          onNavigate?.();
        }}
        className="mb-1 flex h-[26px] items-center gap-1.5 rounded-[4px] px-2 text-[13px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5 text-fg-faint" aria-hidden="true" />
        <span className="font-medium">Settings</span>
      </button>

      {SETTINGS_RAIL_GROUPS.map((g) => (
        <div key={g.group} className="mt-2.5">
          <div className="flex items-center gap-2 px-2.5 pt-1 pb-1">
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-disabled">
              {g.group}
            </span>
          </div>
          <ul className="space-y-px">
            {g.items.map((it) => {
              const href = `/settings?tab=${it.id}`;
              const active = activeTab === it.id;
              return (
                <li key={it.id}>
                  <NavLink
                    href={href}
                    icon={it.icon}
                    label={it.label}
                    active={active}
                    collapsed={false}
                    meta={it.meta}
                    onNavigate={onNavigate}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SidebarContent({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  hideToggle = false,
}: SidebarContentProps) {
  const pathname = usePathname();
  const { isConnected, isLoading, user, disconnect } = useAuth();
  const padX = collapsed ? "px-2.5" : "px-3";

  // Nav — no global environment switcher. Environment is a per-page facet
  // (a filter on Apps / API keys, defaulting to "All environments"), not a
  // persistent global mode, so the sidebar is a flat task list:
  //   • Primary — your organization resources (Home, Apps, API keys, Usage,
  //     Settings — Settings sits last, under Usage).
  //   • NETWORK — the global network (Explore, Stats), its own labeled group.
  //   • Footer — Docs.
  const primaryItems = PORTAL_NAV_ITEMS.filter((i) => i.zone !== "network");
  const networkItems = PORTAL_NAV_ITEMS.filter((i) => i.zone === "network");

  const renderNavItem = (item: (typeof PORTAL_NAV_ITEMS)[number]) => {
    const Icon = NAV_ICONS[item.icon];
    const active = getNavActive(item.href, pathname);
    // Right-aligned mono meta counts. Only render expanded; collapsed shows
    // icon only.
    let meta: string | undefined;
    if (!collapsed) {
      if (item.href === "/") meta = formatRuns(APPS.length);
      else if (item.href === "/apps")
        meta = String(PIPELINES.length);
      else if (item.href === "/keys")
        meta = formatRuns(SETTINGS_API_KEYS.length);
    }
    const itemKbd = "kbd" in item ? (item.kbd as string) : undefined;
    const itemSubmenu = "submenu" in item ? Boolean(item.submenu) : false;
    return (
      <li key={item.href}>
        <NavLink
          href={item.href}
          icon={Icon}
          label={item.label}
          active={active}
          collapsed={collapsed}
          meta={meta}
          kbd={!collapsed ? itemKbd : undefined}
          submenu={itemSubmenu}
          onNavigate={onNavigate}
        />
      </li>
    );
  };

  // Logged-out sidebar variant — per the v4 prototype's `loggedOut` Sidebar
  // (components.jsx:43). Brand wordmark in place of the organization switcher,
  // Explore + Docs as the only enabled routes, the organization block (Home /
  // Jobs / Usage / API keys) shown but locked, and a Free-tier promo block
  // replacing the organization usage card. We intentionally render this only
  // once auth state has hydrated to avoid a one-frame flash of the signed-in
  // chrome on cold load.
  if (!isLoading && !isConnected) {
    return (
      <SignedOutSidebarContent
        collapsed={collapsed}
        padX={padX}
        onToggleCollapsed={onToggleCollapsed}
        hideToggle={hideToggle}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-shell">
      {/* Top: organization switcher (FB Flipbook ▾). Per the v6 prototype, the
          row is *just* the switcher — no "+ New" button, no collapse toggle.
          Organization-scoped actions live inside the dropdown instead. */}
      <div
        className={`flex shrink-0 items-center pt-2 pb-1 ${padX} ${collapsed ? "flex-col gap-2.5" : "gap-1"}`}
      >
        <div className={collapsed ? "" : "min-w-0 flex-1"}>
          {isConnected && user ? (
            <OrganizationMenu user={user} disconnect={disconnect} collapsed={collapsed} />
          ) : (
            <Link
              href="/home"
              aria-label="Livepeer Developer Dashboard"
              className="flex items-center"
              onClick={onNavigate}
            >
              {collapsed ? (
                <LivepeerSymbol className="h-5 w-5 text-fg" aria-hidden="true" />
              ) : (
                <LivepeerWordmark className="h-3.5 w-auto text-fg" aria-hidden="true" />
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className={`shrink-0 pb-2 ${padX}`}>
        {collapsed ? (
          <button
            type="button"
            aria-label="Search"
            onClick={() => {
              const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
              document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", [isMac ? "metaKey" : "ctrlKey"]: true }),
              );
            }}
            className="mx-auto flex h-[26px] w-[26px] items-center justify-center rounded-[4px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const isMac =
                typeof navigator !== "undefined" &&
                navigator.platform.toUpperCase().includes("MAC");
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  [isMac ? "metaKey" : "ctrlKey"]: true,
                }),
              );
            }}
            className="flex w-full items-center gap-2 rounded-[8px] border border-hairline bg-dark-lighter px-2.5 py-1.5 text-[12.5px] text-fg-faint transition-colors hover:border-subtle hover:text-fg-strong"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="flex-1 text-left">Search</span>
            <kbd className="font-mono text-[10.5px] tracking-wider text-fg-faint">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Destinations. Home + your organization resources are the unlabeled
          primary list (scope shown per-page via the header chip); the global
          NETWORK destinations get their own labeled section below. On /settings
          the whole list is replaced by the SettingsRail. */}
      {pathname.startsWith("/settings") ? (
        <SettingsRail pathname={pathname} padX={padX} onNavigate={onNavigate} />
      ) : (
        <>
          {/* Primary — your organization resources. Environment is a per-page
              facet (a filter on Apps / Runs / API keys), not a global mode, so
              there's no environment switcher heading these. */}
          <nav aria-label="Primary" className={`pb-1 ${padX}`}>
            <ul className="space-y-px">{primaryItems.map(renderNavItem)}</ul>
          </nav>

          {/* NETWORK — the global network: browse the catalog + network health.
              A distinct category from your own resources above. */}
          <nav aria-label="Network" className={`pb-1 ${padX}`}>
            {!collapsed && (
              <div className="px-2.5 pt-2 pb-1">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-disabled">
                  Network
                </span>
              </div>
            )}
            <ul className="space-y-px">{networkItems.map(renderNavItem)}</ul>
          </nav>
        </>
      )}

      {/* Spacer pushes footer to the bottom */}
      <div className="flex-1" />

      {/* Plan + usage card — between flex spacer and footer per the
          Livepeer Console design v2 (Apr 2026, `.side-usage`). The 8px
          bottom margin (pb-2) clears the footer's border-t hairline so the
          card doesn't visually sit on the divider. Hidden when collapsed
          (no useful 26px representation) AND when the user is inside the
          settings sub-experience — the organization usage strip would compete
          with the settings rail's own context. */}
      {isConnected && !collapsed && !pathname.startsWith("/settings") && (
        <div className={`shrink-0 ${padX} pb-2`}>
          <SidebarUsageCard />
        </div>
      )}

      {/* Footer: Docs. (Settings now sits under Usage in the primary list.)
          Logged-out users get a separate footer rendered by
          `SignedOutSidebarContent`; this one is signed-in only. */}
      <div className={`shrink-0 border-t border-hairline pt-2 pb-2 ${padX} space-y-px`}>
        <NavLink
          href="https://docs.livepeer.org"
          icon={BookOpen}
          label="Docs"
          collapsed={collapsed}
          external
          onNavigate={onNavigate}
        />
      </div>

      {/* Statuspage row — operational health, external link. */}
      <div className={`shrink-0 border-t border-hairline ${padX} py-2`}>
        {collapsed ? (
          // Tooltip's inline-flex wrapper would left-align the link inside
          // the padded `<div>` parent. Centering wrapper here matches the
          // recipe used inside `NavLink` for the same reason.
          <div className="flex justify-center">
            <Tooltip content="All services operational" side="right">
              <a
                href="https://status.livepeer.org"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Status: all services operational (opens in new tab)"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] transition-colors hover:bg-hover"
              >
                <StatusDot tone="green" size="md" />
              </a>
            </Tooltip>
          </div>
        ) : (
          <a
            href="https://status.livepeer.org"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Status: all services operational (opens in new tab)"
            className="flex h-7 w-full items-center gap-2 rounded-md px-2 font-mono text-[11px] tracking-[0.02em] text-fg-faint transition-colors hover:bg-zebra hover:text-fg-muted"
          >
            <StatusDot tone="green" />
            <span className="min-w-0 flex-1 truncate">All systems operational</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-fg-disabled" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────

export default function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // ignore
    }
    // Defer transition enablement one frame so the initial width doesn't animate.
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Avoid flashing the wrong width before localStorage read completes.
  // Width matches the Livepeer Console design (--side-w 232px).
  const desktopWidth = collapsed ? "md:w-14" : "md:w-[232px]";
  const transition = hydrated ? "transition-[width] duration-200 ease-out" : "";

  return (
    <>
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-green focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar
       *  z-30 establishes a stacking context above the main content area
       *  (which has its own implicit context via `overflow-y-auto`). Without
       *  this, absolutely-positioned children that escape the sidebar's
       *  bounds — e.g. the OrganizationMenu dropdown — paint *under* main-area
       *  content (model thumbnails) because main comes later in DOM order. */}
      <aside
        className={`hidden md:flex sticky top-0 z-30 h-screen shrink-0 flex-col ${desktopWidth} ${transition}`}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-40 flex md:hidden h-14 items-center gap-2 border-b border-hairline bg-shell px-4">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="dashboard-sidebar-drawer"
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-fg-strong transition-colors hover:bg-tint hover:text-fg"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile overlay drawer */}
      <Drawer
        id="dashboard-sidebar-drawer"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ariaLabel="Navigation"
        side="left"
      >
        <SidebarContent collapsed={false} hideToggle onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );
}
