"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BarChart3, Box } from "lucide-react";
import { useAuth } from "@/components/console/AuthContext";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import ConsolePageSkeleton from "@/components/console/ConsolePageSkeleton";
import SignInWall from "@/components/console/SignInWall";
import UsageView from "@/components/console/UsageView";

export default function UsagePage() {
  return (
    <Suspense fallback={<ConsolePageSkeleton kpiCount={4} withChart />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const { isConnected, isLoading } = useAuth();

  // Avoid flashing the wall while auth hydrates.
  if (isLoading) return null;

  // Workspace-only route — logged-out users see "Usage is workspace-only"
  // wall in place of the console. The previous behavior (a hard redirect
  // to /login) was wrong per the v4 prototype: it dropped the
  // user out of context. The wall keeps them inside the app shell, leaves
  // the sidebar in its logged-out variant, and offers an explicit
  // "Explore capabilities" escape hatch.
  if (!isConnected) return <SignInWall route="usage" />;

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <ConsolePageHeader
        title="Usage"
        icon={BarChart3}
        description="Signed requests, network cost, and prepaid balance usage from PymtHouse OpenMeter."
        actions={
          <Link
            href="/settings?tab=billing"
            className="btn-primary inline-flex h-[26px] items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] font-medium transition-colors"
          >
            <Box className="h-3 w-3" aria-hidden="true" />
            Manage plan
          </Link>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <UsageView />
      </div>
    </main>
  );
}
