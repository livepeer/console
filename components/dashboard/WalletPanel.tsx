"use client";

import { useEffect, useState } from "react";
import Button from "@/components/design-system/Button";
import { useOwnerWallet } from "@/lib/dashboard/useOwnerWallet";
import {
  collectionSchedule,
  formatWalletUsd,
  overageBufferMeter,
  spendPostureBadge,
  type SpendPostureTone,
} from "@/lib/dashboard/wallet-settlement-display";

type TopUpFlash = "succeeded" | "canceled" | "pm-saved";

function readTopUpFlash(): TopUpFlash | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("topup");
  if (value === "succeeded" || value === "canceled" || value === "pm-saved") {
    return value;
  }
  return null;
}

function clearTopUpQueryParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("topup")) return;
  url.searchParams.delete("topup");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function formatInvoiceDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const QUICK_AMOUNTS = ["10.00", "25.00", "100.00"] as const;

const POSTURE_TONE_CLASS: Record<SpendPostureTone, string> = {
  ok: "border-emerald-400/30 text-emerald-400",
  info: "border-hairline text-fg-muted",
  warn: "border-amber-400/30 text-amber-400",
  danger: "border-rose-400/30 text-rose-400",
};

const METER_TONE_CLASS: Record<SpendPostureTone, string> = {
  ok: "bg-emerald-400",
  info: "bg-fg-muted",
  warn: "bg-amber-400",
  danger: "bg-rose-400",
};

/** Only follow https (or localhost http, for dev) Checkout URLs. */
function redirectToCheckout(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid checkout URL");
  }
  const isLocalhost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    throw new Error("Unsafe checkout URL");
  }
  window.location.assign(parsed.toString());
}

export default function WalletPanel({
  externalUserId,
  periodBillableUsdMicros = null,
}: {
  externalUserId: string | undefined;
  /** Period end-user billable USD micros from the Usage page (metered usage, not credits). */
  periodBillableUsdMicros?: string | null;
}) {
  const { state, reload, startTopUp, startPaymentMethodCheckout, ensureDefaultPaymentMethod } =
    useOwnerWallet(Boolean(externalUserId), externalUserId);
  const [showTopUp, setShowTopUp] = useState(false);
  const [amountUsd, setAmountUsd] = useState<string>("25.00");
  const [busy, setBusy] = useState<"topup" | "pm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<TopUpFlash | null>(null);

  useEffect(() => {
    const next = readTopUpFlash();
    if (!next) return;
    setFlash(next);
    clearTopUpQueryParam();
    if (next === "pm-saved") {
      void (async () => {
        try {
          await ensureDefaultPaymentMethod();
        } catch {
          // Webhook may already have promoted; list still refreshes below.
        }
        void reload();
      })();
    } else if (next === "succeeded") {
      void reload();
    }
  }, [ensureDefaultPaymentMethod, reload]);

  async function onTopUp() {
    setError(null);
    setBusy("topup");
    try {
      const { checkoutUrl } = await startTopUp({ amountUsd: amountUsd.trim() });
      redirectToCheckout(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Top-up failed");
      setBusy(null);
    }
  }

  async function onAddPaymentMethod() {
    setError(null);
    setBusy("pm");
    try {
      const { checkoutUrl } = await startPaymentMethodCheckout();
      redirectToCheckout(checkoutUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment method setup failed",
      );
      setBusy(null);
    }
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="mt-4 animate-pulse rounded-md border border-hairline bg-dark-lighter px-4 py-6">
        <div className="h-4 w-40 rounded bg-white/5" />
        <div className="mt-3 h-16 rounded bg-white/5" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-4 rounded-md border border-hairline bg-dark-lighter px-4 py-4">
        <p className="text-sm text-fg-muted">Could not load wallet.</p>
        <p className="mt-1 font-mono text-xs text-fg-faint">{state.message}</p>
        <Button
          className="mt-3"
          variant="secondary"
          size="sm"
          onClick={() => void reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const { wallet, paymentMethods, invoices } = state;
  const balanceUsd = wallet.balance?.usd ?? "0.00";
  const usageUsd = formatWalletUsd(periodBillableUsdMicros);
  const billingState = wallet.billingState;
  const posture = spendPostureBadge(billingState.status);
  const meter = overageBufferMeter(billingState);
  const defaultPm =
    paymentMethods.find((pm) => pm.isDefault) ?? paymentMethods[0] ?? null;
  const hasPaymentMethod =
    wallet.paymentMethod.hasDefault ?? paymentMethods.length > 0;

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className={`rounded-[3px] border px-1.5 py-px font-mono text-[10.5px] uppercase tracking-[0.06em] ${POSTURE_TONE_CLASS[posture.tone]}`}
            >
              {posture.label}
            </span>
            <p className="text-[13px] font-semibold text-fg">
              {billingState.explain.headline}
            </p>
          </div>
          <p className="mt-1 max-w-prose text-[12px] text-fg-muted">
            {billingState.explain.detail}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                Included usage
              </p>
              <p className="mt-1 font-mono text-[28px] font-medium tabular-nums tracking-[-0.01em] text-fg">
                $
                {billingState.funding.includedUsage?.remaining.usd ??
                  billingState.funding.included.usd}
              </p>
              {billingState.funding.includedUsage &&
              billingState.funding.includedUsage.total.usdMicros !== "0" ? (
                <p className="mt-1 text-[11px] text-fg-muted">
                  $
                  {billingState.funding.includedUsage.consumed.usd} of $
                  {billingState.funding.includedUsage.total.usd} used
                  {billingState.funding.includedUsage.sourcePlan?.name
                    ? ` · ${billingState.funding.includedUsage.sourcePlan.name}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div>
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                Prepaid credits
              </p>
              <p className="mt-1 font-mono text-[28px] font-medium tabular-nums tracking-[-0.01em] text-fg">
                ${balanceUsd}
              </p>
            </div>
            {meter ? (
              <div>
                <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                  Spending buffer
                </p>
                <p className="mt-1 font-mono text-[20px] font-medium tabular-nums tracking-[-0.01em] text-fg sm:text-[28px]">
                  {meter.primary}
                </p>
                <div
                  className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5"
                  role="progressbar"
                  aria-label="Spending buffer used"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={meter.percent}
                >
                  <div
                    className={`h-full rounded-full ${METER_TONE_CLASS[posture.tone]}`}
                    style={{ width: `${meter.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-fg-muted">{meter.status}</p>
              </div>
            ) : (
              <div>
                <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                  Usage this period
                </p>
                <p className="mt-1 font-mono text-[28px] font-medium tabular-nums tracking-[-0.01em] text-fg">
                  ${usageUsd}
                </p>
              </div>
            )}
          </div>
          <p className="mt-3 text-[12px] text-fg-muted">
            {collectionSchedule(billingState)}
          </p>
          {wallet.payPerUsePlans.map((plan) => (
            <p key={plan.planId} className="mt-1 text-[11px] text-fg-faint">
              {plan.planName}: {plan.resolvedBehavior}
            </p>
          ))}
        </div>
        <div className="flex flex-col items-end gap-2">
          {showTopUp ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-fg-faint">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="h-[30px] w-24 rounded-[4px] border border-hairline bg-dark-card px-2 font-mono text-[13px] tabular-nums text-fg outline-none focus-visible:ring-1 focus-visible:ring-green-bright/30"
                aria-label="Top-up amount in USD"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={busy === "topup"}
                onClick={() => void onTopUp()}
              >
                {busy === "topup" ? "Redirecting…" : "Continue"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy === "topup"}
                onClick={() => setShowTopUp(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setShowTopUp(true)}>
              Add funds
            </Button>
          )}
          {showTopUp ? (
            <div className="flex gap-1.5">
              {QUICK_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountUsd(preset)}
                  className="rounded-[4px] border border-hairline bg-dark-card px-2 py-0.5 font-mono text-[11px] tabular-nums text-fg-muted transition-colors hover:border-subtle hover:text-fg"
                >
                  ${preset}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {flash === "succeeded" ? (
        <p className="border-b border-hairline px-4 py-2 text-[12px] text-emerald-400">
          Funds added. Your balance updates once Stripe settles the payment.
        </p>
      ) : null}
      {flash === "pm-saved" ? (
        <p className="border-b border-hairline px-4 py-2 text-[12px] text-emerald-400">
          Payment method saved.
        </p>
      ) : null}
      {flash === "canceled" ? (
        <p className="border-b border-hairline px-4 py-2 text-[12px] text-fg-muted">
          Checkout canceled.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-fg">
            Payment method for usage billing
          </p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {hasPaymentMethod && defaultPm
              ? `${defaultPm.brand ?? defaultPm.type}${defaultPm.last4 ? ` •••• ${defaultPm.last4}` : ""}`
              : hasPaymentMethod
                ? "Payment method on file."
                : "No payment method on file — progressive invoices cannot charge once credits run out."}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy === "pm"}
          onClick={() => void onAddPaymentMethod()}
        >
          {busy === "pm"
            ? "Redirecting…"
            : hasPaymentMethod
              ? "Update payment method"
              : "Add payment method"}
        </Button>
      </div>

      <div className="px-4 py-3">
        <p className="text-[13px] font-semibold text-fg">Billing history</p>
        {invoices.length === 0 ? (
          <p className="mt-1 text-[12px] text-fg-faint">
            No invoices or top-ups yet.
          </p>
        ) : (
          <ul className="mt-1.5 divide-y divide-hairline">
            {invoices.slice(0, 8).map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-1.5"
              >
                <span className="font-mono text-[12px] text-fg-strong">
                  {invoice.number ?? invoice.id}
                </span>
                <span className="text-[11.5px] text-fg-faint">
                  {formatInvoiceDate(invoice.issuedAt ?? invoice.periodEnd)}
                </span>
                <span className="rounded-[3px] border border-hairline px-1.5 py-px font-mono text-[10.5px] uppercase tracking-wide text-fg-muted">
                  {invoice.invoiceType === "auto_topup"
                    ? "top-up"
                    : invoice.status}
                </span>
                <span className="font-mono text-[12px] tabular-nums text-fg">
                  {invoice.totalAmount} {invoice.currency.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="border-t border-hairline px-4 py-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
