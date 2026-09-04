"use client";

import Link from "next/link";
import { useAuth } from "@/components/console/AuthContext";
import { useWalletBillingState } from "@/lib/console/useOwnerWallet";
import { microsToUsd } from "@/lib/console/usage-capability-display";
import { includedUsageSummary } from "@/lib/console/wallet-settlement-display";

/**
 * Sidebar balance meter. It shows the remaining balance against the amount
 * issued for the current plan period.
 */
export default function SidebarUsageCard() {
  const { isConnected } = useAuth();
  const wallet = useWalletBillingState(isConnected);
  const included =
    wallet.state.status === "ready"
      ? includedUsageSummary(wallet.state.wallet.billingState)
      : null;

  if (
    isConnected &&
    (wallet.state.status === "loading" || wallet.state.status === "idle")
  ) {
    return (
      <div
        className="mx-1 mt-2 block animate-pulse rounded-md border border-subtle bg-sidebar-card-bg px-2.5 py-2"
        aria-hidden="true"
      >
        <div className="h-3 w-24 rounded bg-tint" />
        <div className="mt-2 h-3 w-28 rounded bg-tint" />
        <div className="mt-2 h-1 rounded bg-tint" />
      </div>
    );
  }

  if (wallet.state.status === "error") {
    return (
      <Link
        href="/home"
        title="Open usage details"
        className="mx-1 mt-2 block rounded-md border border-subtle bg-sidebar-card-bg px-2.5 py-2 transition-colors hover:bg-sidebar-card-bg-hover"
      >
        <span className="font-mono text-[10.5px] text-fg-faint">
          Balance unavailable
        </span>
      </Link>
    );
  }

  if (wallet.state.status !== "ready") return null;

  let remainingUsd: number;
  let issuedUsd: number;

  if (included) {
    remainingUsd = microsToUsd(included.remainingUsdMicros);
    issuedUsd = microsToUsd(included.totalUsdMicros);
  } else {
    remainingUsd = microsToUsd(wallet.state.wallet.balance?.usdMicros ?? "0");
    issuedUsd = Math.max(
      remainingUsd,
      microsToUsd(wallet.state.wallet.balance?.lifetimeGrantedUsdMicros ?? "0")
    );
  }

  const pct =
    issuedUsd > 0 ? Math.min(100, (remainingUsd / issuedUsd) * 100) : 0;
  const canSpend = wallet.state.wallet.billingState.canSpend;

  return (
    <Link
      href="/home"
      title="Open usage details"
      aria-label={`Balance: $${remainingUsd.toFixed(2)} remaining of $${issuedUsd.toFixed(2)} issued`}
      className="mx-1 mt-2 block rounded-md border border-subtle bg-sidebar-card-bg px-2.5 py-2.5 transition-colors hover:bg-sidebar-card-bg-hover"
    >
      <p className="text-[16px] font-medium leading-none text-fg">
        ${issuedUsd.toFixed(2)}{" "}
        <span className="text-[12.5px] font-normal text-fg-faint">
          / ${remainingUsd.toFixed(2)} remaining
        </span>
      </p>
      <div
        className="mt-2.5 h-1 overflow-hidden rounded-[2px] bg-tint"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-[2px] ${
            canSpend ? "bg-gradient-to-r from-green to-green-bright" : "bg-warm"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}
