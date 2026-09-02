"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/components/console/AuthContext";
import ConsolePageSkeleton from "@/components/console/ConsolePageSkeleton";
import SignInWall from "@/components/console/SignInWall";
import AccountSection from "@/components/console/settings/AccountSection";
import AppearanceSection from "@/components/console/settings/AppearanceSection";

// Settings is two tabs for the creator pilot:
//   - `account`    — the merged former General + Profile (see AccountSection)
//   - `appearance` — the local-only theme picker (light/dark/system)
//
// Four tabs are hidden rather than deleted; their sections still exist under
// components/console/settings/ and come back by re-adding them here and to
// SETTINGS_RAIL_ITEMS in ConsoleSidebar:
//   - `members`       — team workspaces are backlogged; nothing behind the UI.
//   - `billing`       — blocked on an unresolved question about which entity
//                       bills (PymtHouse vs. Foundation vs. Inc). Shipping a
//                       billing page before that is settled reads as "billing
//                       is done" when the dependency is still open.
//   - `notifications` — no notification delivery exists.
//   - `security`      — session/2FA controls are owned by Auth0, not by us.
//
// No "usage-limits" tab: concurrent streams, per-key rate limits and allowed
// regions were dropped (Aug 2026), and the one limit worth keeping — the hard
// spend cap — belongs on the Usage meter, not in a settings form. See the
// Spend cap note in CLAUDE.md.
type SettingsTab = "account" | "appearance";

const VALID_TABS: SettingsTab[] = ["account", "appearance"];

const TAB_LABELS: Record<SettingsTab, string> = {
  account: "Account",
  appearance: "Appearance",
};

/**
 * Old tab ids that still resolve. `organization` and `profile` are the two
 * pages that merged into `account`; the rest are hidden sections whose links
 * are still in the wild (bookmarks, the org menu's old Billing entry). All of
 * them land on Account rather than 404-ing or rendering a hidden section.
 */
const RETIRED_TABS = new Set([
  "organization",
  "profile",
  "members",
  "billing",
  "notifications",
  "security",
]);

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <ConsolePageSkeleton
          maxWidth="5xl"
          withTabs={false}
          kpiCount={0}
          withChart={false}
        />
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { isConnected, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get("tab");

  // Back-compat redirects for old tab ids.
  // - `tab=tokens` → /keys (kept so the URL still resolves even though API
  //   keys is out of the nav for the pilot)
  // - `tab=usage` → /usage (top-level route)
  // - retired/merged tabs → drop the param entirely, landing on Account
  useEffect(() => {
    if (rawTab === "tokens") {
      router.replace("/keys");
    } else if (rawTab === "usage") {
      router.replace("/usage");
    } else if (rawTab === "account" || rawTab === null) {
      // Already canonical — nothing to do.
    } else if (
      RETIRED_TABS.has(rawTab) ||
      !VALID_TABS.includes(rawTab as SettingsTab)
    ) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [rawTab, router, pathname, searchParams]);

  // Default to "account" when no tab param is set.
  const tab: SettingsTab = VALID_TABS.includes(rawTab as SettingsTab)
    ? (rawTab as SettingsTab)
    : "account";

  // Wait for auth to hydrate so we don't flash the wrong state.
  if (isLoading) return null;

  // Organization-only — logged-out users see the sign-in wall.
  if (!isConnected) return <SignInWall route="settings" />;

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      {/* Breadcrumb chrome bar — Settings / {sub-tab label}. Mirrors the v7
          prototype's `<PageHead crumbs={...} />` which uses the cog icon on
          the first crumb and the active tab label on the second. */}
      <div className="flex h-[44px] shrink-0 items-center gap-1 border-b border-hairline bg-dark px-5">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <SettingsIcon
            className="h-3.5 w-3.5 shrink-0 text-fg-faint"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>Settings</span>
        </Link>
        <span className="px-1 text-fg-disabled" aria-hidden="true">
          /
        </span>
        <span className="px-1.5 py-1 text-[13px] font-medium text-fg">
          {TAB_LABELS[tab]}
        </span>
      </div>

      {/* Body — single-column "settings shell" matching the prototype's
          `.settings-shell-solo` (max-width 880px, padding 4px 28px 80px). */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-[880px] px-7 pt-6 pb-20">
          {tab === "account" && <AccountSection />}
          {tab === "appearance" && <AppearanceSection />}
        </div>
      </div>
    </main>
  );
}
