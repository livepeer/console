"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { BarChart3, Box, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/console/AuthContext";
import { useEnvironment } from "@/components/console/EnvironmentContext";
import EnvironmentFilter, {
  ALL_ENVIRONMENTS as ALL,
} from "@/components/console/EnvironmentFilter";
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
  const { environments } = useEnvironment();
  const [envFilter, setEnvFilter] = useState(ALL);

  // Avoid flashing the wall while auth hydrates.
  if (isLoading) return null;
  if (!isConnected) return <SignInWall route="usage" />;

  const selected = environments.find((e) => e.id === envFilter);
  // Consumption split: production carries the bulk, development the rest.
  const weight =
    envFilter === ALL ? 1 : selected?.kind === "production" ? 0.91 : 0.09;
  const filterName =
    envFilter === ALL
      ? "all environments"
      : (selected?.name ?? "all environments");

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <ConsolePageHeader
        title="Usage"
        icon={BarChart3}
        description="Requests, latency, errors, and spend across your API tokens."
        actions={
          <>
            <EnvironmentFilter value={envFilter} onChange={setEnvFilter} />
            <button
              type="button"
              className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
            >
              <span className="text-fg-faint">Period</span>
              <span>30 days</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
            <Link
              href="/settings?tab=billing"
              className="btn-primary inline-flex h-[26px] items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] font-medium transition-colors"
            >
              <Box className="h-3 w-3" aria-hidden="true" />
              Manage plan
            </Link>
          </>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <UsageView weight={weight} filterName={filterName} />
      </div>
    </main>
  );
}
