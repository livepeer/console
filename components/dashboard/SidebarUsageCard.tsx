"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useAccountUsage } from "@/lib/dashboard/useAccountUsage";
import {
  formatPeriodResetLabel,
  microsToUsdDisplay,
} from "@/lib/dashboard/usage-capability-display";

function fmtCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

/**
 * SidebarUsageCard — bottom-of-sidebar plan + usage indicator.
 *
 * Data comes from PymtHouse (OpenMeter) via `/api/pymthouse/account-usage`.
 */
export default function SidebarUsageCard() {
  const { user } = useAuth();
  const usage = useAccountUsage(user?.email?.trim(), 30);

  if (usage.status === "loading" || usage.status === "idle") {
    return (
      <div
        className="mx-1 mt-2 block animate-pulse rounded-md border border-subtle bg-sidebar-card-bg px-2.5 py-2"
        aria-hidden="true"
      >
        <div className="h-3 w-24 rounded bg-tint" />
        <div className="my-1.5 h-1 rounded bg-tint" />
        <div className="h-2.5 w-full rounded bg-tint" />
      </div>
    );
  }

  if (usage.status === "error") {
    return (
      <Link
        href="/usage"
        title="Open usage details"
        className="mx-1 mt-2 block rounded-md border border-subtle bg-sidebar-card-bg px-2.5 py-2 transition-colors hover:bg-sidebar-card-bg-hover"
      >
        <span className="font-mono text-[10.5px] text-fg-faint">Usage unavailable</span>
      </Link>
    );
  }

  const { data } = usage;
  const balance = data.balance;
  const showUsdAllowance =
    balance && BigInt(balance.lifetimeGrantedUsdMicros || "0") > BigInt(0);

  const resetsAt = formatPeriodResetLabel(data.period.end);
  const planLabel = showUsdAllowance ? "Starter" : "Usage";

  let primaryUsed: number;
  let primaryLimit: number | null;
  let primaryDisplay: ReactNode;

  if (showUsdAllowance && balance) {
    const granted = BigInt(balance.lifetimeGrantedUsdMicros || "1");
    const consumed = BigInt(balance.consumedUsdMicros || "0");
    primaryUsed = Number((consumed * BigInt(10000)) / granted) / 100;
    primaryLimit = 100;
    primaryDisplay = (
      <>
        <b className="font-medium text-fg">${microsToUsdDisplay(balance.balanceUsdMicros)}</b>
        <span className="text-fg-faint"> / ${microsToUsdDisplay(balance.lifetimeGrantedUsdMicros)}</span>
      </>
    );
  } else {
    const used = data.current.requestCount;
    const limit = 10_000;
    primaryUsed = used;
    primaryLimit = limit;
    primaryDisplay = (
      <>
        <b className="font-medium text-fg">{fmtCompact(used)}</b>
        <span className="text-fg-faint"> / {fmtCompact(limit)}</span>
      </>
    );
  }

  const pct =
    primaryLimit && primaryLimit > 0
      ? Math.min(100, (primaryUsed / primaryLimit) * 100)
      : 0;
  const pctDisplay = pct >= 10 ? pct.toFixed(0) : pct.toFixed(2);

  return (
    <Link
      href="/usage"
      title="Open usage details"
      className="mx-1 mt-2 block rounded-md border border-subtle bg-sidebar-card-bg px-2.5 py-2 transition-colors hover:bg-sidebar-card-bg-hover"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-faint">
          {planLabel}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-fg-strong">{primaryDisplay}</span>
      </div>
      <div
        className="my-1.5 h-1 overflow-hidden rounded-[2px] bg-tint"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-[2px] ${
            balance && !balance.hasAccess
              ? "bg-warm"
              : "bg-gradient-to-r from-green to-green-bright"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-fg-faint">
          {showUsdAllowance ? "remaining" : `${pctDisplay}% used`}
        </span>
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-fg-faint">
          resets {resetsAt}
        </span>
      </div>
    </Link>
  );
}
