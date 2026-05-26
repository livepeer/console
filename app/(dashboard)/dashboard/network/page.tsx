"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { BarChart3, Activity, Globe, Wallet, Cpu, ArrowUpRight } from "lucide-react";
import OverviewTab from "@/components/dashboard/statistics/OverviewTab";
import UtilizationTab from "@/components/dashboard/statistics/UtilizationTab";
import PaymentsTab from "@/components/dashboard/statistics/PaymentsTab";
import GpusTab from "@/components/dashboard/statistics/GpusTab";
import TabStrip from "@/components/dashboard/TabStrip";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import DashboardPageSkeleton from "@/components/dashboard/DashboardPageSkeleton";

/**
 * "Updated Xs ago" pill with a breathing green dot. Network is a monitoring
 * surface — recency is the page's whole job, so the chrome surfaces it
 * visibly. Updates the relative-time label every 5 seconds; mock-only for
 * now (the real source would be a backend `lastUpdatedAt` from each tab's
 * data fetcher).
 */
function LastUpdatedPill() {
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecondsAgo((s) => s + 5), 5000);
    return () => clearInterval(id);
  }, []);
  const label =
    secondsAgo < 60
      ? `${secondsAgo}s ago`
      : `${Math.floor(secondsAgo / 60)}m ago`;
  return (
    <span className="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full bg-green-bright/10 px-2.5 text-[11px] font-medium text-green-bright">
      <span
        className="h-1.5 w-1.5 animate-breathe rounded-full bg-green-bright"
        aria-hidden="true"
      />
      <span className="hidden sm:inline">Live · updated </span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}

type NetworkTab = "overview" | "utilization" | "payments" | "gpus";

const VALID_TABS: NetworkTab[] = ["overview", "utilization", "payments", "gpus"];

const TABS: { key: NetworkTab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "utilization", label: "Utilization", icon: Activity },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "gpus", label: "GPUs", icon: Cpu },
];

export default function NetworkPage() {
  return (
    <Suspense
      fallback={<DashboardPageSkeleton withTabs kpiCount={4} withChart />}
    >
      <NetworkContent />
    </Suspense>
  );
}

function NetworkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get("tab");
  const tab: NetworkTab = VALID_TABS.includes(rawTab as NetworkTab)
    ? (rawTab as NetworkTab)
    : "overview";

  const setTab = useCallback(
    (key: NetworkTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", key);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  // Network is public — orchestrators, payments, and GPU inventory are
  // network-wide state, not workspace-scoped, so the page renders for
  // signed-out visitors too. (Earlier the route was sign-in-walled to
  // match the v4 prototype's per-workspace framing; that gate has been
  // removed because none of the tabs surface user-specific data.)

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <DashboardPageHeader
        title="Network"
        icon={Globe}
        description="Live state of the open GPU network — orchestrators, payments, hardware."
        actions={
          <>
            <LastUpdatedPill />
            <a
              href="https://status.livepeer.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] font-medium text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
            >
              Status page
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </a>
          </>
        }
      />

      {/* Horizontal tab strip — width matches the tab content's max-w-[1200px]
          so the active-tab underline lines up with the panels below it. */}
      <div className="sticky top-0 z-20 border-b border-hairline bg-dark">
        <div className="mx-auto w-full max-w-[1200px] px-7">
          <TabStrip
            tabs={TABS}
            active={tab}
            onChange={setTab}
            layoutId="network-tabs"
            ariaLabel="Network sections"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1">
          {tab === "overview" && <OverviewTab />}
          {tab === "utilization" && <UtilizationTab />}
          {tab === "payments" && <PaymentsTab />}
          {tab === "gpus" && <GpusTab />}
        </div>
      </div>
    </main>
  );
}
