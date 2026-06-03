"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronDown, House } from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthContext";
import { getOrgFleet } from "@/lib/dashboard/org-fleet";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import FirstRunChecklist, {
  FIRST_RUN_CHANGED_EVENT,
  FIRST_RUN_DISMISSED_KEY,
} from "@/components/dashboard/FirstRunChecklist";
import HomeCommandBar from "@/components/dashboard/HomeCommandBar";
import AppsHealthPanel from "@/components/dashboard/AppsHealthPanel";
import ConsumedAppsPanel from "@/components/dashboard/ConsumedAppsPanel";
import ActivityPanel from "@/components/dashboard/ActivityPanel";
import SectionHeader from "@/components/dashboard/SectionHeader";

// ─── Home page header — chrome bar with Period selector + actions ───

function HomePageHeader() {
  return (
    <DashboardPageHeader
      title="Home"
      icon={House}
      actions={
        <>
          <button
            type="button"
            className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
          >
            <span className="text-fg-faint">Period</span>
            <span>7d</span>
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
          <Link
            href="/usage"
            className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
          >
            <BarChart3 className="h-3 w-3" aria-hidden="true" />
            View usage
          </Link>
        </>
      }
    />
  );
}

// ─── Home Page ───
//
// "Mission control" rethink: a workspace sits between two flows of network
// traffic — what it SERVES (inbound, apps it deployed) and what it CONSUMES
// (outbound, apps across the network, mostly ones it didn't deploy). The Home
// is organized around those two directions, not around personas. Composition:
//   1. Command bar — system readout (served + spent) + greeting + an adaptive
//      attention line naming the single most urgent thing on arrival
//   2. Get started — auto-detecting onboarding, until the loop is done
//   3. Two ledgers — Deployed apps (what you serve: calls + Yours/External)
//      beside Usage (what you consume: spend + Your apps/Others'). Each panel
//      leads with its own directional summary; no separate hero band.
//   4. Recent activity — the workspace's own requests (what counts toward
//      its usage); a live preview of /usage

export default function HomePage() {
  const { isConnected, isLoading, user } = useAuth();
  const router = useRouter();

  // Signed-out users redirect to / — the public landing.
  // The Home view is organization-only (KPIs, recent runs, capability
  // leaderboard), and a SignInWall on the root /home URL was the
  // wrong default: visitors arrived at a sign-in gate before they'd had a
  // chance to see what's on the platform. Explore is the discovery surface
  // and the right entry point for unauthenticated visitors.
  useEffect(() => {
    if (!isLoading && (!isConnected || !user)) {
      router.replace("/");
    }
  }, [isLoading, isConnected, user, router]);

  // Signed-in users get the inline first-run checklist unless they've
  // dismissed it (via Skip, "I've made my first call", or by clicking through
  // to the playground). Quickstart in the sidebar footer clears this flag to
  // re-open the checklist. Mock-only gate: in production we'd ALSO check
  // server-side run history, but in mock mode the flag alone is the source
  // of truth (MOCK_RECENT_REQUESTS is always non-empty for the organization demo).
  const [firstRunDismissed, setFirstRunDismissed] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () =>
      setFirstRunDismissed(
        window.localStorage.getItem(FIRST_RUN_DISMISSED_KEY) === "1",
      );
    read();
    // Cross-tab updates via storage; same-tab updates (e.g. Quickstart click in
    // the sidebar) via a custom event since storage events don't fire in the
    // window that wrote the value.
    const onStorage = (e: StorageEvent) => {
      if (e.key === FIRST_RUN_DISMISSED_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(FIRST_RUN_CHANGED_EVENT, read);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FIRST_RUN_CHANGED_EVENT, read);
    };
  }, []);

  if (isLoading) return null;

  const showFirstRun = isConnected && firstRunDismissed === false;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FIRST_RUN_DISMISSED_KEY, "1");
    }
    setFirstRunDismissed(true);
  };

  // Organization name + greeting first-name (stand-ins until real organizations +
  // proper user profile fields exist; matches the design spec).
  const organization = "Flipbook";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // The Fleet anchors the console split; a consumer-only org with no deployed
  // apps drops to a single column so the Vitals rail carries the page.
  const hasApps = getOrgFleet().count > 0;

  // Signed-out users are redirected to / via the useEffect
  // above; render nothing in the meantime (one frame max) so they don't see
  // a flash of organization-mock data before the redirect lands.
  if (!isConnected || !user) {
    return null;
  }

  // Hold off rendering signed-in content for one frame while we read the
  // localStorage flag, so the organization doesn't flash before the checklist.
  if (firstRunDismissed === null) {
    return <main id="main-content" className="flex flex-1 flex-col bg-dark" />;
  }

  // Signed-in operations console — see the composition note above HomePage.
  return (
    <main id="main-content" className="relative flex flex-1 flex-col bg-dark">
      {/* Atmosphere — a faint brand-green aura bleeding from the top edge, so
          the console reads as a lit panel rather than a flat page. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(70% 100% at 50% 0%, color-mix(in oklab, var(--color-green-bright) 7%, transparent) 0%, transparent 72%)",
        }}
        aria-hidden="true"
      />

      <HomePageHeader />
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-8">
          <div className="home-rise">
            <HomeCommandBar organization={organization} firstName={firstName} />
          </div>

          {/* Onboarding — auto-detecting: deploy an example app, then call it.
              Shown until dismissed; full-width above the console split. */}
          {showFirstRun && (
            <div className="home-rise" style={{ animationDelay: "60ms" }}>
              <SectionHeader
                title="Get started"
                action={
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1 text-fg-faint transition-colors hover:text-fg-strong"
                  >
                    Skip ✕
                  </button>
                }
              />
              <FirstRunChecklist onDismiss={handleDismiss} />
            </div>
          )}

          {/* The two ledgers — Deployed apps (what you serve) beside Usage
              (what you consume). Each leads with its own directional summary
              (served split / spend split), so there's no separate hero band.
              On a consumer-only org with no deployed apps, Usage carries the
              row on its own. */}
          {hasApps ? (
            <div
              className="home-rise mt-7 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2"
              style={{ animationDelay: "120ms" }}
            >
              <AppsHealthPanel />
              <ConsumedAppsPanel organization={organization} />
            </div>
          ) : (
            <div className="home-rise mt-7" style={{ animationDelay: "120ms" }}>
              <ConsumedAppsPanel organization={organization} />
            </div>
          )}

          {/* Recent activity — the workspace's own recent requests (what
              counts toward its usage); a live preview of /usage. */}
          <div className="home-rise mt-7" style={{ animationDelay: "220ms" }}>
            <ActivityPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
