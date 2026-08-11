"use client";

import { useEffect, useState } from "react";
import Button from "@/components/design-system/Button";
import type { DashboardBillingPlan } from "@/lib/dashboard/pymthouse-billing-bff";
import { useBillingPlans } from "@/lib/dashboard/useBillingPlans";

function isUsagePlan(plan: Pick<DashboardBillingPlan, "type">): boolean {
  return plan.type.trim().toLowerCase() === "usage";
}

function formatPrice(plan: DashboardBillingPlan): string {
  const n = Number(plan.priceAmount);
  const money = Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: plan.priceCurrency || "USD",
      }).format(n)
    : plan.priceAmount;

  if (isUsagePlan(plan)) return `${money} · pay as you go`;
  if (!plan.billingCycle) return money;
  const c = plan.billingCycle.toLowerCase();
  if (c === "monthly" || c === "month") return `${money}/mo`;
  if (c === "yearly" || c === "year" || c === "annual") return `${money}/yr`;
  return `${money} · ${plan.billingCycle}`;
}

function resolvedPayPerUseBehavior(plan: DashboardBillingPlan): string {
  const resolved = plan.resolvedBehavior?.trim();
  if (resolved) return resolved;

  return "Usage draws down included usage first, then prepaid credits, then is invoiced automatically as it accrues.";
}

function readCheckoutFlash(): "success" | "cancel" | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("checkout");
  if (value === "success" || value === "cancel") return value;
  return null;
}

function clearCheckoutQueryParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("checkout")) return;
  url.searchParams.delete("checkout");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function PlansPanel({
  externalUserId,
}: {
  externalUserId: string | undefined;
}) {
  const { state, reload, subscribe, changePlan } =
    useBillingPlans(externalUserId);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<"success" | "cancel" | null>(null);

  useEffect(() => {
    const next = readCheckoutFlash();
    if (!next) return;
    setFlash(next);
    clearCheckoutQueryParam();
    if (next === "success") {
      void reload();
    }
  }, [reload]);

  async function onSubscribe(planId: string) {
    if (!externalUserId?.trim()) {
      setError("Sign in to subscribe.");
      return;
    }
    setError(null);
    setBusyPlanId(planId);
    try {
      const userId = externalUserId.trim();
      const plans = state.status === "ready" ? state.plans : [];
      const targetPlan = plans.find((p) => p.id === planId);
      const activePlanId =
        state.status === "ready" ? state.subscription?.planId : null;
      const activeStatus =
        state.status === "ready"
          ? (state.subscription?.status?.toLowerCase() ?? "")
          : "";
      const hasActiveSubscription =
        Boolean(activePlanId) &&
        (activeStatus === "active" ||
          activeStatus === "pending" ||
          activeStatus === "trialing" ||
          activeStatus === "scheduled");

      // Starter/default users already have a subscription — switch instead of
      // create, so pay-per-use can still collect a setup Checkout card.
      const result = hasActiveSubscription
        ? await changePlan({
            planId,
            externalUserId: userId,
            successUrl: `${window.location.origin}/usage?checkout=success`,
            cancelUrl: `${window.location.origin}/usage?checkout=cancel`,
          })
        : await subscribe({
            planId,
            externalUserId: userId,
            successUrl: `${window.location.origin}/usage?checkout=success`,
            cancelUrl: `${window.location.origin}/usage?checkout=cancel`,
          });

      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      await reload();
      setError(
        targetPlan && isUsagePlan(targetPlan)
          ? "Plan updated. Add a payment method in Settings → Billing for pay-per-use auto-debit."
          : "Plan updated.",
      );
      setBusyPlanId(null);
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

  const activePlanId = state.subscription?.planId ?? null;
  const activeStatus = state.subscription?.status?.toLowerCase() ?? "";
  const hasActiveSubscription =
    Boolean(activePlanId) &&
    (activeStatus === "active" ||
      activeStatus === "pending" ||
      activeStatus === "trialing" ||
      activeStatus === "scheduled");

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="border-b border-hairline px-4 py-3.5">
        <p className="text-[17px] font-bold text-fg">Plans</p>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Subscribe via PymtHouse → Stripe Checkout
        </p>
        {flash === "success" ? (
          <p className="mt-2 text-[12px] text-emerald-400">
            Payment method saved
            {hasActiveSubscription && state.subscription?.planName
              ? ` · on ${state.subscription.planName}`
              : ""}
            .
          </p>
        ) : null}
        {flash === "cancel" ? (
          <p className="mt-2 text-[12px] text-fg-muted">Checkout canceled.</p>
        ) : null}
      </div>
      <ul className="divide-y divide-hairline">
        {state.plans.map((plan) => {
          const isCurrent = hasActiveSubscription && plan.id === activePlanId;
          return (
            <li
              key={plan.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-fg">{plan.name || plan.id}</p>
                <p className="mt-0.5 font-mono text-[11px] text-fg-faint">
                  {formatPrice(plan)}
                  {plan.capabilityCount > 0
                    ? ` · ${plan.capabilityCount} capabilities`
                    : ""}
                </p>
                {isUsagePlan(plan) ? (
                  <p className="mt-1 text-[11px] text-fg-faint">
                    {resolvedPayPerUseBehavior(plan)}
                  </p>
                ) : null}
              </div>
              {isCurrent ? (
                <span className="rounded-[4px] border border-hairline px-2.5 py-1 text-[12px] font-medium text-fg-muted">
                  Current plan
                </span>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!externalUserId || busyPlanId === plan.id}
                  onClick={() => void onSubscribe(plan.id)}
                >
                  {busyPlanId === plan.id
                    ? "Redirecting…"
                    : isUsagePlan(plan)
                      ? "Enable pay-per-use"
                      : "Subscribe"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="border-t border-hairline px-4 py-2 text-xs text-rose-400">{error}</p>
      ) : null}
    </div>
  );
}
