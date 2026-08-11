"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useAccountUsage } from "@/lib/dashboard/useAccountUsage";
import {
  formatPeriodResetLabel,
  microsToUsd,
} from "@/lib/dashboard/usage-capability-display";

/**
 * SidebarUsageCard — bottom-of-sidebar plan + usage indicator.
 *
 * Data comes from PymtHouse (OpenMeter) via `/api/pymthouse/account-usage`.
 * Prefer the plan included-discount allowance (USD). If that is unavailable,
 * show period spend in dollars — never a fake request-count free tier.
 */
export default function SidebarUsageCard() {
  const { user } = useAuth();
  const usage = useAccountUsage(user?.id?.trim(), 30);

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
  const planLabel = showUsdAllowance ? "Included usage" : "Usage";

  let primaryUsed: number;
  let primaryLimit: number | null;
  let primaryDisplay: ReactNode;
  let footerLeft: string;

  if (showUsdAllowance && balance) {
    const granted = BigInt(balance.lifetimeGrantedUsdMicros || "1");
    const consumed = BigInt(balance.consumedUsdMicros || "0");
    primaryUsed = Number((consumed * BigInt(10000)) / granted) / 100;
    primaryLimit = 100;
    primaryDisplay = (
      <>
        <b className="font-medium text-fg">
          ${microsToUsd(balance.consumedUsdMicros).toFixed(2)}
        </b>
        <span className="text-fg-faint">
          {" "}
          / ${microsToUsd(balance.lifetimeGrantedUsdMicros).toFixed(2)}
        </span>
      </>
    );
    footerLeft = "used";
  } else {
    // No plan allowance yet — show period spend in dollars (Home MTD uses the
    // same OpenMeter fee total), not a request-count free-tier placeholder.
    const spendUsd = Number(
      BigInt(data.current.endUserBillableUsdMicros || data.current.networkFeeUsdMicros || "0"),
    ) / 1_000_000;
    primaryUsed = 0;
    primaryLimit = null;
    primaryDisplay = (
      <b className="font-medium text-fg">${spendUsd.toFixed(2)}</b>
    );
    footerLeft = "spent";
  }

  const pct =
    primaryLimit && primaryLimit > 0
      ? Math.min(100, (primaryUsed / primaryLimit) * 100)
      : 0;

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
          {footerLeft}
        </span>
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-fg-faint">
          resets {resetsAt}
        </span>
      </div>
    </Link>
  );
}
