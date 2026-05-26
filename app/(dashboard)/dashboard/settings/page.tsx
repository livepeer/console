"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthContext";
import DashboardPageSkeleton from "@/components/dashboard/DashboardPageSkeleton";
import SignInWall from "@/components/dashboard/SignInWall";
import GeneralSection from "@/components/dashboard/settings/GeneralSection";
import MembersSection from "@/components/dashboard/settings/MembersSection";
import BillingSection from "@/components/dashboard/settings/BillingSection";
import LimitsSection from "@/components/dashboard/settings/LimitsSection";
import ProfileSection from "@/components/dashboard/settings/ProfileSection";
import NotificationsSection from "@/components/dashboard/settings/NotificationsSection";
import SecuritySection from "@/components/dashboard/settings/SecuritySection";
import AppearanceSection from "@/components/dashboard/settings/AppearanceSection";

// The 8 settings sub-tabs, two groups (Workspace + Account). The sidebar's
// SettingsRail is the navigation surface — there's no horizontal TabStrip on
// this page; the rail and the breadcrumb together tell the user where they
// are. `appearance` is the local-only theme picker (light/dark/system) added
// in the theme-modes pass.
type SettingsTab =
  | "workspace"
  | "members"
  | "billing"
  | "usage-limits"
  | "profile"
  | "notifications"
  | "security"
  | "appearance";

const VALID_TABS: SettingsTab[] = [
  "workspace",
  "members",
  "billing",
  "usage-limits",
  "profile",
  "notifications",
  "security",
  "appearance",
];

const TAB_LABELS: Record<SettingsTab, string> = {
  workspace: "General",
  members: "Members",
  billing: "Billing",
  "usage-limits": "Limits",
  profile: "Profile",
  notifications: "Notifications",
  security: "Security",
  appearance: "Appearance",
};

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardPageSkeleton
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
  // - `tab=tokens` → /dashboard/keys (API keys is its own primary route now)
  // - `tab=account` → drop the param entirely (defaulting to General)
  // - `tab=usage` → /dashboard/usage (top-level route)
  useEffect(() => {
    if (rawTab === "tokens") {
      router.replace("/dashboard/keys");
    } else if (rawTab === "usage") {
      router.replace("/dashboard/usage");
    } else if (rawTab === "account") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [rawTab, router, pathname, searchParams]);

  // Default to "workspace" (General) when no tab param is set.
  const tab: SettingsTab = VALID_TABS.includes(rawTab as SettingsTab)
    ? (rawTab as SettingsTab)
    : "workspace";

  // Wait for auth to hydrate so we don't flash the wrong state.
  if (isLoading) return null;

  // Workspace-only — logged-out users see the sign-in wall.
  if (!isConnected) return <SignInWall route="settings" />;

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      {/* Breadcrumb chrome bar — Settings / {sub-tab label}. Mirrors the v7
          prototype's `<PageHead crumbs={...} />` which uses the cog icon on
          the first crumb and the active tab label on the second. */}
      <div className="flex h-[44px] shrink-0 items-center gap-1 border-b border-hairline bg-dark px-5">
        <Link
          href="/dashboard"
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
          {tab === "workspace" && <GeneralSection />}
          {tab === "members" && <MembersSection />}
          {tab === "billing" && <BillingSection />}
          {tab === "usage-limits" && <LimitsSection />}
          {tab === "profile" && <ProfileSection />}
          {tab === "notifications" && <NotificationsSection />}
          {tab === "security" && <SecuritySection />}
          {tab === "appearance" && <AppearanceSection />}
        </div>
      </div>
    </main>
  );
}
