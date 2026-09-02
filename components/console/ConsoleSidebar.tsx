"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  House,
  LayoutGrid,
  BarChart3,
  ChevronLeft,
  Globe,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import {
  LivepeerWordmark,
  LivepeerSymbol,
} from "@/components/design-system/LivepeerLogo";
import { EXTERNAL_LINKS, PORTAL_NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/components/console/AuthContext";
import Drawer from "@/components/design-system/Drawer";
import Tooltip from "@/components/design-system/Tooltip";
import NavLink from "@/components/console/NavLink";
import SidebarUsageCard from "@/components/console/SidebarUsageCard";
import OrganizationMenu from "@/components/console/OrganizationMenu";
import { APPS } from "@/lib/console/mock-data";
import { formatRuns } from "@/lib/console/utils";

const NAV_ICONS = {
  House,
  LayoutGrid,
  BarChart3,
  Globe,
  Settings: SettingsIcon,
} as const;

const COLLAPSED_KEY = "console.sidebar.collapsed";

function getNavActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/home") return pathname === "/home";
  // Tab-deep links inherit active state from path only — Settings page tabs
  // already mark the current sub-tab visually inside their own TabStrip.
  if (itemHref.includes("?")) {
    const path = itemHref.split("?")[0];
    return pathname.startsWith(path);
  }
  return pathname.startsWith(itemHref);
}

// ─── Site link ──────────────────────────────────────────────────────────────
//
// The one footer row the rail keeps: a way back to livepeer.org. It sits
// below the usage card in every rail state (expanded, collapsed, settings,
// signed out) and opens in a new tab — leaving for the marketing site is a
// detour, not a sign-out, so the console stays where it was. Deliberately a
// single row: the Docs / status strip this replaces grew because footers
// accrete, and this one should not.

function SiteLink({ collapsed, padX }: { collapsed: boolean; padX: string }) {
  const label = "livepeer.org";
  const link = (
    <a
      href={EXTERNAL_LINKS.site}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      className={`flex h-[26px] items-center rounded-[4px] text-[12px] text-fg-faint transition-colors hover:bg-hover hover:text-fg ${
        collapsed ? "w-[26px] justify-center" : "w-full gap-2 px-2.5"
      }`}
    >
      <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ArrowUpRight
            className="h-3 w-3 shrink-0 text-fg-disabled"
            aria-hidden="true"
          />
        </>
      )}
    </a>
  );

  return (
    <div className={`shrink-0 border-t border-hairline py-1.5 ${padX}`}>
      {collapsed ? (
        <div className="flex justify-center">
          <Tooltip content={label} side="right">
            {link}
          </Tooltip>
        </div>
      ) : (
        link
      )}
    </div>
  );
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
  // Explore is canonically /explore, but signed-out visitors also see it as the
  // landing at /, so both count as "on Explore".
  const exploreActive = pathname === "/" || pathname.startsWith("/explore");

  return (
    <div className="flex h-full flex-col bg-shell">
      {/* Brand row — wordmark links to / (the public landing) */}
      <div
        className={`flex shrink-0 items-center pt-2 pb-2 ${padX} ${collapsed ? "flex-col gap-2.5" : "gap-1"}`}
      >
        <Link
          href="/"
          aria-label="Livepeer Console — explore apps"
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
                })
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
                })
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

      {/* Public nav — Explore + Stats. (Docs is not linked: docs.livepeer.org
          is orchestrator-only today and documents none of the agent surface.
          Restore the entry once the agent docs land.) */}
      <nav aria-label="Public navigation" className={`pb-2 ${padX}`}>
        <ul className="space-y-px">
          <li>
            <NavLink
              href="/explore"
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

      <SiteLink collapsed={collapsed} padX={padX} />
    </div>
  );
}

// ─── Settings rail ──────────────────────────────────────────────────────────
//
// Renders inline inside the signed-in `SidebarContent` when the user is on a
// `/settings*` route: a back-arrow header that returns to `/home`, then the
// settings destinations. The organization switcher and search above stay put;
// the usage strip below stays put — only the main nav block swaps to this
// rail.
//
// The pilot rail is FLAT — two entries, no group eyebrows. It used to carry an
// `Organization` group (General / Members / Billing) and an `Account` group
// (Profile / Notifications / Security). Members, Billing, Notifications and
// Security are all hidden for the pilot, and General and Profile merged into
// one page, which leaves two items: keeping two group headers over a
// one-item-each split would be labelling for its own sake.
//
// Active item is determined by `?tab=<id>` on the current path. Items whose
// content isn't built yet still navigate (the route renders the closest
// existing tab) so the rail's behavior is correct end-to-end.
//
// The tab is read with `useSearchParams`, which forces its caller into a
// Suspense boundary: layouts never receive `searchParams`, so the value is
// client-only during static prerender. The boundary is what keeps the server
// and client renders in agreement — reading `window.location.search` behind a
// `typeof window` check instead makes the server pick the default tab while
// the client picks the real one, which is a hydration mismatch.

const SETTINGS_RAIL_ITEMS: {
  id: string;
  label: string;
  icon: LucideIcon;
  meta?: string;
}[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
];

function SettingsRailView({
  activeTab,
  padX,
  onNavigate,
}: {
  activeTab: string | null;
  padX: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();

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

      <ul className="mt-2.5 space-y-px">
        {SETTINGS_RAIL_ITEMS.map((it) => (
          <li key={it.id}>
            <NavLink
              href={`/settings?tab=${it.id}`}
              icon={it.icon}
              label={it.label}
              active={activeTab === it.id}
              collapsed={false}
              meta={it.meta}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsRailNav({
  padX,
  onNavigate,
}: {
  padX: string;
  onNavigate?: () => void;
}) {
  // Default to "account" when on `/settings` with no tab param — Account is
  // the page /settings renders with no tab.
  const activeTab = useSearchParams().get("tab") ?? "account";

  return (
    <SettingsRailView
      activeTab={activeTab}
      padX={padX}
      onNavigate={onNavigate}
    />
  );
}

function SettingsRail({
  padX,
  onNavigate,
}: {
  padX: string;
  onNavigate?: () => void;
}) {
  // The fallback renders the rail with nothing marked active rather than
  // guessing "account": a brief un-highlighted rail is honest, whereas a
  // defaulted one flashes the wrong tab before the real one resolves.
  return (
    <Suspense
      fallback={
        <SettingsRailView
          activeTab={null}
          padX={padX}
          onNavigate={onNavigate}
        />
      }
    >
      <SettingsRailNav padX={padX} onNavigate={onNavigate} />
    </Suspense>
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
  //   • Footer — Docs.
  // The NETWORK group (Explore, Stats) is not rendered in the signed-in rail:
  // those routes still exist and stay linkable, they just aren't console
  // destinations. Their entries remain in PORTAL_NAV_ITEMS, filtered out here.
  const primaryItems = PORTAL_NAV_ITEMS.filter((i) => i.zone !== "network");

  const renderNavItem = (item: (typeof PORTAL_NAV_ITEMS)[number]) => {
    const Icon = NAV_ICONS[item.icon];
    const active = getNavActive(item.href, pathname);
    // No nav item carries a right-aligned count any more — the one that did
    // was API keys, which the pilot doesn't provision.
    const meta: string | undefined = undefined;
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
            <OrganizationMenu
              user={user}
              disconnect={disconnect}
              collapsed={collapsed}
            />
          ) : (
            <Link
              href="/home"
              aria-label="Livepeer Console"
              className="flex items-center"
              onClick={onNavigate}
            >
              {collapsed ? (
                <LivepeerSymbol
                  className="h-5 w-5 text-fg"
                  aria-hidden="true"
                />
              ) : (
                <LivepeerWordmark
                  className="h-3.5 w-auto text-fg"
                  aria-hidden="true"
                />
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
              const isMac =
                typeof navigator !== "undefined" &&
                navigator.platform.toUpperCase().includes("MAC");
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  [isMac ? "metaKey" : "ctrlKey"]: true,
                })
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
                })
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
          primary list (scope shown per-page via the header chip). On /settings
          the whole list is replaced by the SettingsRail. */}
      {pathname.startsWith("/settings") ? (
        <SettingsRail padX={padX} onNavigate={onNavigate} />
      ) : (
        <>
          {/* Primary — your organization resources. Environment is a per-page
              facet (a filter on Apps / Runs / API keys), not a global mode, so
              there's no environment switcher heading these. */}
          <nav aria-label="Primary" className={`pb-1 ${padX}`}>
            <ul className="space-y-px">{primaryItems.map(renderNavItem)}</ul>
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

      {/* Footer — the single livepeer.org row. Docs was removed from here
          because docs.livepeer.org is orchestrator-only and says nothing
          about the agent; restore it beside this row once agent docs land. */}
      <SiteLink collapsed={collapsed} padX={padX} />
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────

export default function ConsoleSidebar() {
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
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {/* Mobile top bar with hamburger */}
      <div className="sticky top-0 z-40 flex md:hidden h-14 items-center gap-2 border-b border-hairline bg-shell px-4">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="console-sidebar-drawer"
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-fg-strong transition-colors hover:bg-tint hover:text-fg"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile overlay drawer */}
      <Drawer
        id="console-sidebar-drawer"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ariaLabel="Navigation"
        side="left"
      >
        <SidebarContent
          collapsed={false}
          hideToggle
          onNavigate={() => setDrawerOpen(false)}
        />
      </Drawer>
    </>
  );
}
