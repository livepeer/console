"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BarChart3, Box, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthContext";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import DashboardPageSkeleton from "@/components/dashboard/DashboardPageSkeleton";
import SignInWall from "@/components/dashboard/SignInWall";
import UsageView from "@/components/dashboard/UsageView";

export default function UsagePage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton kpiCount={4} withChart />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const { isConnected, isLoading } = useAuth();

  // Avoid flashing the wall while auth hydrates.
  if (isLoading) return null;

  // Workspace-only route — logged-out users see "Usage is workspace-only"
  // wall in place of the dashboard. The previous behavior (a hard redirect
  // to /dashboard/login) was wrong per the v4 prototype: it dropped the
  // user out of context. The wall keeps them inside the app shell, leaves
  // the sidebar in its logged-out variant, and offers an explicit
  // "Explore capabilities" escape hatch.
  if (!isConnected) return <SignInWall route="usage" />;

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <DashboardPageHeader
        title="Usage"
        icon={BarChart3}
        description="Requests, latency, errors, and spend across your API tokens."
        actions={
          <>
            <button
              type="button"
              className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
            >
              <span className="text-fg-faint">Period</span>
              <span>30 days</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
            <Link
              href="/dashboard/settings?tab=billing"
              className="btn-primary inline-flex h-[26px] items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] font-medium transition-colors"
            >
              <Box className="h-3 w-3" aria-hidden="true" />
              Manage plan
            </Link>
          </>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <UsageView />
      </div>
    </main>
  );
}
