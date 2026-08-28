"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/console/AuthContext";
import {
  buildOrgConsumptionFromUsage,
  formatCompact,
} from "@/lib/console/org-consumption";
import type { ConsumedApp } from "@/lib/console/org-consumption";
import { useAccountUsage } from "@/lib/console/useAccountUsage";

/**
 * Usage — the CONSUME (outbound) panel: a spend summary (split between your own
 * apps and apps you didn't deploy) over the list of apps this organization calls.
 * The counterpart to "Deployed apps". The owner sub-line tells own vs external
 * apart, so there's no separate tag column.
 *
 * Data: PymtHouse account-usage (OpenMeter) — MTD spend + trailing 7d calls.
 */

const GRID =
  "grid items-center gap-3 px-5 grid-cols-[minmax(0,1fr)_72px] sm:grid-cols-[minmax(0,1fr)_84px_72px]";

function moneyShort(n: number): string {
  return `$${n.toFixed(2)}`;
}

function PanelShell({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-dark-lighter shadow-card">
      {children}
    </section>
  );
}

function PanelHeader({
  totalSpendDisplay,
  totalCalls7d,
}: {
  totalSpendDisplay: string;
  totalCalls7d: number;
}) {
  return (
    <div className="border-b border-hairline px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-fg">Usage</h2>
        <Link
          href="/usage"
          className="group inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] uppercase tracking-[0.04em] text-fg-faint transition-colors hover:text-fg"
        >
          View usage
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[22px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-fg">
          {totalSpendDisplay}
        </span>
        <span className="font-mono text-[12px] text-fg-faint">spent · MTD</span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-fg-faint">
          {formatCompact(totalCalls7d)} calls
        </span>
      </div>
    </div>
  );
}

function ColumnHeaders() {
  return (
    <div
      className={`${GRID} border-b border-hairline bg-dark py-2 font-mono text-[10px] uppercase tracking-[0.07em] text-fg-disabled`}
    >
      <span>App</span>
      <span className="hidden text-right sm:block">Calls · 7d</span>
      <span className="text-right">Spend</span>
    </div>
  );
}

export default function ConsumedAppsPanel({
  organization,
}: {
  organization: string;
}) {
  const { isConnected } = useAuth();
  const usage = useAccountUsage(isConnected, {
    window: "mtd",
    includePrior: false,
  });

  if (usage.status === "loading" || usage.status === "idle") {
    return (
      <PanelShell>
        <div
          className="animate-pulse border-b border-hairline px-5 py-4"
          aria-hidden="true"
        >
          <div className="h-4 w-16 rounded bg-tint" />
          <div className="mt-3 h-6 w-40 rounded bg-tint" />
        </div>
        <div className="space-y-0 px-5 py-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="h-8 w-36 rounded bg-tint" />
              <div className="h-3 w-12 rounded bg-tint" />
            </div>
          ))}
        </div>
      </PanelShell>
    );
  }

  if (usage.status === "error") {
    return (
      <PanelShell>
        <PanelHeader totalSpendDisplay="$0.00" totalCalls7d={0} />
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-fg-muted">Could not load usage.</p>
          <p className="mt-1 font-mono text-[11px] text-fg-faint">
            {usage.message}
          </p>
          <button
            type="button"
            onClick={() => void usage.reload()}
            className="mt-4 font-mono text-[11.5px] uppercase tracking-[0.04em] text-fg-faint transition-colors hover:text-fg"
          >
            Retry
          </button>
        </div>
      </PanelShell>
    );
  }

  const { apps, totalSpendDisplay, totalCalls7d } =
    buildOrgConsumptionFromUsage(usage.data, organization);

  return (
    <PanelShell>
      <PanelHeader
        totalSpendDisplay={totalSpendDisplay}
        totalCalls7d={totalCalls7d}
      />
      <ColumnHeaders />

      {apps.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-fg-muted">No usage this month yet.</p>
          <Link
            href="/usage"
            className="mt-2 inline-block font-mono text-[11.5px] uppercase tracking-[0.04em] text-fg-faint transition-colors hover:text-fg"
          >
            View usage →
          </Link>
        </div>
      ) : (
        /* Top apps by spend — capped so the panel reads as even-height beside
           "Recent activity"; totals above still reflect the full set, and
           "View usage" links to the rest. */
        apps.slice(0, 7).map((a: ConsumedApp, i) => {
          const href = a.owned
            ? `/apps/${a.id}?tab=overview`
            : `/?q=${encodeURIComponent(a.name)}`;
          return (
            <Link
              key={a.id}
              href={href}
              className={`${GRID} py-3 transition-colors hover:bg-zebra ${
                i > 0 ? "border-t border-hairline" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-fg">
                  {a.name}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-fg-faint">
                  {a.owner}
                </span>
              </span>
              <span className="hidden text-right font-mono text-[12.5px] tabular-nums text-fg-strong sm:block">
                {formatCompact(a.calls7d)}
              </span>
              <span className="text-right font-mono text-[12.5px] tabular-nums text-fg-strong">
                {moneyShort(a.spendNum)}
              </span>
            </Link>
          );
        })
      )}
    </PanelShell>
  );
}
