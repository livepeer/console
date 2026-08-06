"use client";

import { useState } from "react";
import Button from "@/components/design-system/Button";
import { useBillingPlans } from "@/lib/dashboard/useBillingPlans";

function formatPrice(amount: string, currency: string, cycle: string | null): string {
  const n = Number(amount);
  const money = Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(n)
    : amount;
  if (!cycle) return money;
  const c = cycle.toLowerCase();
  if (c === "monthly" || c === "month") return `${money}/mo`;
  if (c === "yearly" || c === "year" || c === "annual") return `${money}/yr`;
  return `${money} · ${cycle}`;
}

export default function PlansPanel({
  externalUserId,
}: {
  externalUserId: string | undefined;
}) {
  const { state, reload, subscribe } = useBillingPlans();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubscribe(planId: string) {
    if (!externalUserId?.trim()) {
      setError("Sign in to subscribe.");
      return;
    }
    setError(null);
    setBusyPlanId(planId);
    try {
      const { checkoutUrl } = await subscribe({
        planId,
        externalUserId: externalUserId.trim(),
      });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusyPlanId(null);
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
        <p className="text-sm text-fg-muted">Could not load plans.</p>
        <p className="mt-1 font-mono text-xs text-fg-faint">{state.message}</p>
        <Button className="mt-3" variant="secondary" size="sm" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (state.plans.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="border-b border-hairline px-4 py-3.5">
        <p className="text-[17px] font-bold text-fg">Plans</p>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Subscribe via PymtHouse → Stripe Checkout
        </p>
      </div>
      <ul className="divide-y divide-hairline">
        {state.plans.map((plan) => (
          <li
            key={plan.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-fg">{plan.name || plan.id}</p>
              <p className="mt-0.5 font-mono text-[11px] text-fg-faint">
                {formatPrice(plan.priceAmount, plan.priceCurrency, plan.billingCycle)}
                {plan.capabilityCount > 0
                  ? ` · ${plan.capabilityCount} capabilities`
                  : ""}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={!externalUserId || busyPlanId === plan.id}
              onClick={() => void onSubscribe(plan.id)}
            >
              {busyPlanId === plan.id ? "Redirecting…" : "Subscribe"}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="border-t border-hairline px-4 py-2 text-xs text-rose-400">{error}</p>
      ) : null}
    </div>
  );
}
