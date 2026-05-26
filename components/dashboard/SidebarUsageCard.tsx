"use client";

import Link from "next/link";
import { ACCOUNT_USAGE_SUMMARY } from "@/lib/dashboard/mock-data";

/**
 * SidebarUsageCard — bottom-of-sidebar plan + usage indicator.
 *
 * Per the Livepeer Console design v2 (Apr 2026, `.side-usage` in styles.css):
 * compact bordered card placed between the sidebar's flex spacer and the
 * footer (Network / Docs / Settings + status row). Clicking it routes to the
 * Usage page. Active state when on that route.
 *
 * Visual spec (exact):
 *   - margin 8px 4px 0; padding 9px 10px 8px; border-radius var(--r-md)
 *   - 1px hairline border, bg dark-lighter; hover: border-2 + bg dark-card
 *   - Active: border-green + green-soft tint
 *   - Top row: mono uppercase "Free tier" label · mono 12px "8.7K / 10K"
 *   - 4px gradient bar (lp → lp-bright) at exact pct fill
 *   - Bottom row: "{pct}% used" left · mono "resets {window}" right
 */
export default function SidebarUsageCard() {
  const used = ACCOUNT_USAGE_SUMMARY.freeTierUsed;
  const limit = ACCOUNT_USAGE_SUMMARY.freeTierLimit;
  const pct = Math.min(100, (used / limit) * 100);
  const pctDisplay = pct >= 10 ? pct.toFixed(0) : pct.toFixed(2);

  function fmt(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return n.toString();
  }

  const baseClass =
    "block mt-2 mx-1 rounded-md border px-2.5 py-2 transition-colors";
  // The card stays visually stable across routes. The original design
  // prototype had an active-state (green tint) when on /dashboard/usage,
  // but in practice the green competes with the in-card progress bar
  // and duplicates the main-nav active highlight. Cleaner to keep this
  // a stable usage widget; route-active feedback lives on the Usage nav
  // item in the primary rail.
  const stateClass =
    "border-subtle bg-sidebar-card-bg hover:bg-sidebar-card-bg-hover";

  return (
    <Link
      href="/dashboard/usage"
      title="Open usage details"
      className={`${baseClass} ${stateClass}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-faint">
          Free tier
        </span>
        <span className="font-mono text-[12px] tabular-nums text-fg-strong">
          <b className="font-medium text-fg">{fmt(used)}</b>
          <span className="text-fg-faint"> / {fmt(limit)}</span>
        </span>
      </div>
      <div
        className="my-1.5 h-1 overflow-hidden rounded-[2px] bg-tint"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-[2px] bg-gradient-to-r from-green to-green-bright"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-fg-faint">
          {pctDisplay}% used
        </span>
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-fg-faint">
          resets {ACCOUNT_USAGE_SUMMARY.freeTierResetIn}
        </span>
      </div>
    </Link>
  );
}
