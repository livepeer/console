import Skeleton from "@/components/ui/Skeleton";

interface DashboardPageSkeletonProps {
  /** When true, render a row of tab placeholders below the title. Defaults
   *  match the layout of the page being replaced (Settings, Network have tabs;
   *  Usage doesn't). */
  withTabs?: boolean;
  /** Number of KPI card placeholders. Defaults to 4 — covers the typical
   *  Network/Usage overview rows. Pass 0 to omit. */
  kpiCount?: number;
  /** Render a tall chart placeholder. Defaults true. */
  withChart?: boolean;
  /** Outer max-width to match the page being replaced. */
  maxWidth?: "5xl" | "6xl" | "7xl";
}

/**
 * DashboardPageSkeleton — Suspense fallback shell that mimics a typical
 * dashboard data view (page header + optional tabs + KPI strip + chart slot).
 * Used so cold-loads don't flash a blank panel while React waits for
 * useSearchParams + lazy data to resolve.
 */
export default function DashboardPageSkeleton({
  withTabs = false,
  kpiCount = 4,
  withChart = true,
  maxWidth = "6xl",
}: DashboardPageSkeletonProps) {
  const widthClass =
    maxWidth === "5xl" ? "max-w-5xl" : maxWidth === "7xl" ? "max-w-7xl" : "max-w-6xl";

  return (
    <main className="flex flex-1 flex-col bg-dark">
      <div className={`mx-auto w-full ${widthClass} px-5 pt-6 pb-10 lg:px-6 lg:pt-10`}>
        {/* Page header — title + description */}
        <div className="space-y-2">
          <Skeleton width="w-32" height="h-4" />
          <Skeleton width="w-72" height="h-3" />
        </div>

        {withTabs && (
          <div className="mt-6 flex gap-2">
            <Skeleton width="w-20" height="h-7" />
            <Skeleton width="w-20" height="h-7" />
            <Skeleton width="w-20" height="h-7" />
            <Skeleton width="w-20" height="h-7" />
          </div>
        )}

        {kpiCount > 0 && (
          <div
            className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-hidden="true"
          >
            {Array.from({ length: kpiCount }).map((_, i) => (
              <Skeleton key={i} variant="card" height="h-20" />
            ))}
          </div>
        )}

        {withChart && (
          <div className="mt-8">
            <Skeleton variant="chart" height="h-64" />
          </div>
        )}
      </div>
    </main>
  );
}
