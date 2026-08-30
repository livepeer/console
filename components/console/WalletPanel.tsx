"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import Button from "@/components/design-system/Button";
import { useAuth } from "@/components/console/AuthContext";
import { useOwnerWallet } from "@/lib/console/useOwnerWallet";
import { redirectToCheckout } from "@/lib/console/checkout-redirect";
import {
  availableRunway,
  formatWalletUsd,
  includedUsageSummary,
  overageLimitNote,
  spendPostureBadge,
  type SpendPostureTone,
} from "@/lib/console/wallet-settlement-display";

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
  ok: "border-green-bright/30 text-green-bright",
  info: "border-hairline text-fg-muted",
  warn: "border-warm/30 text-warm",
  danger: "border-red-400/30 text-red-400",
};

const AVAILABLE_TONE_CLASS: Record<SpendPostureTone, string> = {
  ok: "text-fg",
  info: "text-fg",
  warn: "text-warm",
  danger: "text-red-400",
};

export default function WalletPanel({
  periodBillableUsdMicros = null,
}: {
  /** Period end-user billable USD micros from the Usage page (metered usage, not credits). */
  periodBillableUsdMicros?: string | null;
}) {
  const { isConnected } = useAuth();
  const {
    state,
    reload,
    startTopUp,
    startPaymentMethodCheckout,
    ensureDefaultPaymentMethod,
  } = useOwnerWallet(isConnected);
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
        err instanceof Error ? err.message : "Payment method setup failed"
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
  const usageUsd = formatWalletUsd(periodBillableUsdMicros);
  const billingState = wallet.billingState;
  const posture = spendPostureBadge(billingState.status);
  const runway = availableRunway(billingState);
  const included = includedUsageSummary(billingState);
  const limitNote = overageLimitNote(billingState);
  // The long-form schedule sentence reads as a paragraph next to two numbers;
  // the threshold is the only part that changes, so only it earns the space.
  const lead = billingState.collection.leadThreshold;
  const invoiceNote =
    lead.usdMicros === "0"
      ? `Invoiced ${billingState.collection.collectionInterval.toLowerCase()}`
      : `Invoiced at $${lead.usd}`;
  const resetsLabel = included?.resetsAt
    ? new Date(included.resetsAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;
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
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                Available
              </p>
              <p
                className={`mt-1 font-mono text-[28px] font-medium tabular-nums tracking-[-0.01em] ${AVAILABLE_TONE_CLASS[runway.tone]}`}
              >
                {runway.usd}
              </p>
              {runway.detail ? (
                <p className="mt-1 font-mono text-[11px] text-fg-faint">
                  {runway.detail}
                </p>
              ) : null}
            </div>
            <div>
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                Usage this period
              </p>
              <p className="mt-1 font-mono text-[28px] font-medium tabular-nums tracking-[-0.01em] text-fg">
                ${usageUsd}
              </p>
              {resetsLabel ? (
                <p className="mt-1 font-mono text-[11px] text-fg-faint">
                  resets {resetsLabel}
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-3 font-mono text-[11px] text-fg-faint">
            {[limitNote, invoiceNote].filter(Boolean).join(" · ")}
          </p>
          {billingState.explain.docsUrl ? (
            <a
              href={billingState.explain.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12px] text-fg-faint underline decoration-transparent underline-offset-[3px] transition-colors hover:text-fg-strong hover:decoration-current"
            >
              How billing works
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowTopUp(true)}
            >
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
        <p className="border-b border-hairline px-4 py-2 text-[12px] text-green-bright">
          Funds added. Your balance updates once Stripe settles the payment.
        </p>
      ) : null}
      {flash === "pm-saved" ? (
        <p className="border-b border-hairline px-4 py-2 text-[12px] text-green-bright">
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
          <ul className="mt-1.5 divide-y divide-[var(--color-border-hairline)]">
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
        <p className="border-t border-hairline px-4 py-2 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
