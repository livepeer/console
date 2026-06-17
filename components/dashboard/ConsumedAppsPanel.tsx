"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  getOrgConsumption,
  formatCompact,
} from "@/lib/dashboard/org-consumption";
import type { ConsumedApp } from "@/lib/dashboard/org-consumption";

/**
 * Usage — the CONSUME (outbound) panel: a spend summary (split between your own
 * apps and apps you didn't deploy) over the list of apps this organization calls.
 * The counterpart to "Deployed apps". The owner sub-line tells own vs external
 * apart, so there's no separate tag column.
 */

const GRID =
  "grid items-center gap-3 px-5 grid-cols-[minmax(0,1fr)_72px] sm:grid-cols-[minmax(0,1fr)_84px_72px]";

function moneyShort(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function ConsumedAppsPanel({
  organization,
}: {
  organization: string;
}) {
  const { apps, totalSpendDisplay, totalCalls7d } = getOrgConsumption();

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-dark-lighter shadow-card">
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

        {/* Total spend across the apps this organization calls. The per-app rows
            below show which are your own vs others'. */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-[22px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-fg">
            {totalSpendDisplay}
          </span>
          <span className="font-mono text-[12px] text-fg-faint">
            spent · MTD
          </span>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-fg-faint">
            {formatCompact(totalCalls7d)} calls
          </span>
        </div>
      </div>

      <div
        className={`${GRID} border-b border-hairline bg-dark py-2 font-mono text-[10px] uppercase tracking-[0.07em] text-fg-disabled`}
      >
        <span>App</span>
        <span className="hidden text-right sm:block">Calls · 7d</span>
        <span className="text-right">Spend</span>
      </div>

      {/* Top apps by spend — capped so the panel reads as even-height beside
          "Deployed apps"; totals above still reflect the full set, and
          "View usage" links to the rest. */}
      {apps.slice(0, 7).map((a: ConsumedApp, i) => {
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
                {a.owned ? organization.toLowerCase() : a.owner}
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
      })}
    </section>
  );
}
