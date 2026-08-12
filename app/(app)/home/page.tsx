"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { House } from "lucide-react";
import { useAuth } from "@/components/console/AuthContext";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import FirstRunChecklist, {
  FIRST_RUN_CHANGED_EVENT,
  FIRST_RUN_DISMISSED_KEY,
} from "@/components/console/FirstRunChecklist";
import HomeCommandBar from "@/components/console/HomeCommandBar";
import ConsumedAppsPanel from "@/components/console/ConsumedAppsPanel";
import ActivityPanel from "@/components/console/ActivityPanel";
import SectionHeader from "@/components/console/SectionHeader";

// ─── Home page header — just the title chrome ───
//
// No header actions: Home mixes timeframes (calls · 7d, spend · MTD, relative
// activity), so a page-wide "Period" selector would be misleading, and "View
// usage" is already reachable from the sidebar and the Usage panel below.

function HomePageHeader() {
  return <ConsolePageHeader title="Home" icon={House} />;
}

// ─── Home Page ───
//
// The consumer home: what you're using on the network and what it costs.
// (Operator/publishing surfaces — deployed apps, deploy onboarding — live in a
// separate, stacked PR.) Composition:
//   1. Command bar — org readout + greeting
//   2. Get started — auto-detecting onboarding: create your account, get your
//      API key, call an app
//   3. Usage (spend on the apps you call) beside Recent activity (your own
//      calls — a live preview of /calls)

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

          {/* Onboarding — auto-detecting: get your API key, then call an app.
              Shown until dismissed; full-width above the panels. */}
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

          {/* Usage (what you spend calling apps) beside Recent activity (your
              own calls — a live preview of /calls). Even-height pair. */}
          <div
            className="home-rise mt-7 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2"
            style={{ animationDelay: "120ms" }}
          >
            <ConsumedAppsPanel organization={organization} />
            <ActivityPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
