"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/console/AuthContext";
import { useAccountUsage } from "@/lib/console/useAccountUsage";
import { useWalletBillingState } from "@/lib/console/useOwnerWallet";
import {
  formatPeriodResetLabel,
  microsToUsd,
} from "@/lib/console/usage-capability-display";
import { includedUsageSummary } from "@/lib/console/wallet-settlement-display";

/**
 * Sidebar usage meter. Remaining included usage comes from the wallet
 * billing state when the live plan has an allowance; otherwise period spend.
 */
export default function SidebarUsageCard() {
  const { isConnected } = useAuth();
  const usage = useAccountUsage(isConnected, 30);
  const wallet = useWalletBillingState(isConnected);
  const included =
    wallet.state.status === "ready"
      ? includedUsageSummary(wallet.state.wallet.billingState)
      : null;

  if (
    usage.status === "loading" ||
    usage.status === "idle" ||
    (isConnected &&
      (wallet.state.status === "loading" || wallet.state.status === "idle"))
  ) {
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
  const showUsdAllowance = Boolean(included);

  const resetsAt = included?.resetsAt
    ? new Date(included.resetsAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : formatPeriodResetLabel(data.period.end);
  const planLabel =
    included?.planName?.trim() || (showUsdAllowance ? "Included usage" : "Usage");

  let primaryUsed: number;
  let primaryLimit: number | null;
  let primaryDisplay: ReactNode;
  let footerLeft: string;

  if (showUsdAllowance && included) {
    const granted = BigInt(included.totalUsdMicros || "1");
    const consumed = BigInt(included.consumedUsdMicros || "0");
    primaryUsed = Number((consumed * BigInt(10000)) / granted) / 100;
    primaryLimit = 100;
    primaryDisplay = (
      <>
        <b className="font-medium text-fg">
          ${microsToUsd(included.consumedUsdMicros).toFixed(2)}
        </b>
        <span className="text-fg-faint">
          {" "}
          / ${microsToUsd(included.totalUsdMicros).toFixed(2)}
        </span>
      </>
    );
    footerLeft = "used";
  } else {
    const spendUsd =
      Number(
        BigInt(
          data.current.endUserBillableUsdMicros ||
            data.current.networkFeeUsdMicros ||
            "0"
        )
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
            usage.status === "ready" &&
            usage.data.balance &&
            !usage.data.balance.hasAccess
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
