"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/console/AuthContext";
import { useAccountUsage } from "@/lib/console/useAccountUsage";
import { formatPeriodResetLabel } from "@/lib/console/usage-capability-display";

/**
 * Sidebar usage meter. Included-allowance copy lands with the wallet PR;
 * until then this shows period spend from OpenMeter.
 */
export default function SidebarUsageCard() {
  const { isConnected } = useAuth();
  const usage = useAccountUsage(isConnected, 30);

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
        <span className="font-mono text-[10.5px] text-fg-faint">
          Usage unavailable
        </span>
      </Link>
    );
  }

  const { data } = usage;
  const spendUsd =
    Number(
      BigInt(
        data.current.endUserBillableUsdMicros ||
          data.current.networkFeeUsdMicros ||
          "0"
      )
    ) / 1_000_000;
  const primaryDisplay: ReactNode = (
    <b className="font-medium text-fg">${spendUsd.toFixed(2)}</b>
  );

  return (
    <Link
      href="/usage"
      title="Open usage details"
      className="mx-1 mt-2 block rounded-md border border-subtle bg-sidebar-card-bg px-2.5 py-2 transition-colors hover:bg-sidebar-card-bg-hover"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-faint">
          Usage
        </span>
        <span className="font-mono text-[12px] tabular-nums text-fg-strong">
          {primaryDisplay}
        </span>
      </div>
      <div
        className="my-1.5 h-1 overflow-hidden rounded-[2px] bg-tint"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-[2px] ${
            data.balance && !data.balance.hasAccess
              ? "bg-warm"
              : "bg-gradient-to-r from-green to-green-bright"
          }`}
          style={{
            width: data.balance && !data.balance.hasAccess ? "100%" : "0%",
          }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-fg-faint">
          spent
        </span>
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-fg-faint">
          resets {formatPeriodResetLabel(data.period.end)}
        </span>
      </div>
    </Link>
  );
}
