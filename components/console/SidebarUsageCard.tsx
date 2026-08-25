"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/console/AuthContext";
import { useAccountUsage } from "@/lib/console/useAccountUsage";
import { useMeBillingSurface } from "@/lib/console/useMeBillingSurface";
import { useWalletBillingState } from "@/lib/console/useOwnerWallet";
import {
  formatPeriodResetLabel,
  microsToUsd,
} from "@/lib/console/usage-capability-display";
import { includedUsageSummary, sharedPoolUsageMeter } from "@/lib/console/wallet-settlement-display";

/**
 * Sidebar usage meter. Merchant apps use this session's `/me/billing/state`.
 * Owner-rollup apps use this user's spend vs the owner's remaining included.
 */
export default function SidebarUsageCard() {
  const { isConnected } = useAuth();
  const usage = useAccountUsage(isConnected, 30);
  const meBilling = useMeBillingSurface(isConnected);
  const wallet = useWalletBillingState(isConnected);
  const merchantIncluded =
    meBilling.state.status === "ready" &&
    meBilling.state.surface.mode === "merchant" &&
    meBilling.state.surface.state
      ? includedUsageSummary(meBilling.state.surface.state)
      : null;
  const ownerRollup =
    meBilling.state.status === "ready" &&
    meBilling.state.surface.mode === "owner_rollup";
  const actorUsdMicros =
    usage.status === "ready"
      ? usage.data.current.endUserBillableUsdMicros ||
        usage.data.current.networkFeeUsdMicros ||
        "0"
      : "0";
  const poolMeter =
    ownerRollup && wallet.state.status === "ready"
      ? sharedPoolUsageMeter({
          state: wallet.state.wallet.billingState,
          actorUsdMicros,
        })
      : null;
  const included = merchantIncluded;

  if (
    usage.status === "loading" ||
    usage.status === "idle" ||
    (isConnected &&
      (meBilling.state.status === "loading" ||
        meBilling.state.status === "idle")) ||
    (isConnected &&
      ownerRollup &&
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
  const showUsdAllowance = Boolean(included) && !poolMeter;
  const showPoolMeter = Boolean(poolMeter);

  const resetsAt = included?.resetsAt
    ? new Date(included.resetsAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : formatPeriodResetLabel(data.period.end);
  const planLabel = poolMeter
    ? "Your usage"
    : included?.planName?.trim() || (showUsdAllowance ? "Included usage" : "Usage");

  let primaryUsed: number;
  let primaryLimit: number | null;
  let primaryDisplay: ReactNode;
  let footerLeft: string;

  if (showPoolMeter && poolMeter) {
    const available = BigInt(poolMeter.availableUsdMicros || "0");
    const actor = BigInt(poolMeter.actorUsdMicros || "0");
    primaryUsed =
      available > BigInt(0)
        ? Number((actor * BigInt(10000)) / available) / 100
        : 0;
    primaryLimit = 100;
    primaryDisplay = (
      <>
        <b className="font-medium text-fg">${poolMeter.actorUsd}</b>
        <span className="text-fg-faint"> / ${poolMeter.availableUsd}</span>
      </>
    );
    footerLeft = "available";
  } else if (showUsdAllowance && included) {
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
