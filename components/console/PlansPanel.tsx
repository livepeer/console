"use client";

import { useEffect, useState } from "react";
import Button from "@/components/design-system/Button";
import Dialog from "@/components/design-system/Dialog";
import TimingChoicePanel from "@/components/console/TimingChoicePanel";
import type {
  DashboardBillingPlan,
  DashboardScheduledChangeConflict,
} from "@/lib/console/pymthouse-billing";
import {
  defaultCancelTimingChoice,
  deriveBillingPlanAction,
  deriveBillingSubscriptionUiState,
  formatBillingPlanPrice,
  resolveTimingPayload,
  toDateInputValue,
  type SubscriptionTimingChoice,
} from "@/lib/console/billing-subscription-state";
import type { MeBillingSurface } from "@/lib/console/pymthouse-me-billing-bff";
import {
  ScheduledChangeConflictError,
  useBillingPlans,
} from "@/lib/console/useBillingPlans";
import { redirectToCheckout } from "@/lib/console/checkout-redirect";
import { useAuth } from "@/components/console/AuthContext";
import { useWalletBillingState } from "@/lib/console/useOwnerWallet";
import {
  includedUsageRemainingLabel,
  includedUsageSummary,
} from "@/lib/console/wallet-settlement-display";

function isUsagePlan(
  plan: Pick<DashboardBillingPlan, "type" | "isStarterDefault">
): boolean {
  if (plan.isStarterDefault) return false;
  return plan.type.trim().toLowerCase() === "usage";
}

function formatPrice(plan: DashboardBillingPlan): string {
  const { price, priceSub } = formatBillingPlanPrice(plan);
  return `${price}${priceSub}`;
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

function readResumePlanChange(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search)
    .get("changePlan")
    ?.trim();
  return value || null;
}

function clearCheckoutQueryParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["checkout", "changePlan"] as const) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

export default function PlansPanel({
  sessionBilling,
}: {
  sessionBilling?: {
    surface: MeBillingSurface | null;
    loading: boolean;
    reload: () => void;
  };
} = {}) {
  const { isConnected } = useAuth();
  const { state, reload, subscribe, changePlan } = useBillingPlans(isConnected);
  const merchant =
    sessionBilling?.surface?.mode === "merchant" &&
    sessionBilling.surface.wallet
      ? sessionBilling.surface
      : null;
  const wallet = useWalletBillingState(
    isConnected && !merchant && !sessionBilling?.loading
  );
  const included = merchant
    ? includedUsageSummary(merchant.state)
    : wallet.state.status === "ready"
      ? includedUsageSummary(wallet.state.wallet.billingState)
      : null;
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<"success" | "cancel" | null>(null);
  const [changeDialog, setChangeDialog] = useState<{
    planId: string;
    conflict: DashboardScheduledChangeConflict | null;
  } | null>(null);
  const [changeChoice, setChangeChoice] = useState<SubscriptionTimingChoice>(
    defaultCancelTimingChoice()
  );
  const [changeCustomDate, setChangeCustomDate] = useState("");

  useEffect(() => {
    const next = readCheckoutFlash();
    const resumePlanId = readResumePlanChange();
    if (!next && !resumePlanId) return;
    if (resumePlanId && !isConnected) return;

    if (next) setFlash(next);
    clearCheckoutQueryParam();
    if (next !== "success") return;

    void (async () => {
      if (resumePlanId && isConnected) {
        setBusyPlanId(resumePlanId);
        try {
          const result = await changePlan({
            planId: resumePlanId,
            successUrl: `${window.location.origin}/usage?checkout=success&changePlan=${encodeURIComponent(resumePlanId)}`,
            cancelUrl: `${window.location.origin}/usage?checkout=cancel`,
          });
          if (result.checkoutUrl) {
            redirectToCheckout(result.checkoutUrl);
            return;
          }
          await reload();
          sessionBilling?.reload();
          setError("Plan updated.");
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not finish plan change after adding a card"
          );
        } finally {
          setBusyPlanId(null);
        }
        return;
      }
      void reload();
    })();
  }, [reload, changePlan, isConnected]);

  function openChangeTimingDialog(
    planId: string,
    conflict: DashboardScheduledChangeConflict | null = null
  ) {
    setChangeChoice(defaultCancelTimingChoice());
    setChangeCustomDate(
      toDateInputValue(
        conflict?.timingOptions?.minEffectiveAt ??
          (state.status === "ready"
            ? state.subscription?.timingOptions?.change.minEffectiveAt
            : undefined)
      )
    );
    setChangeDialog({ planId, conflict });
  }

  async function runChangePlan(
    planId: string,
    timing?: {
      timing?: string;
      effectiveAt?: string;
      confirmReplaceScheduled?: boolean;
    }
  ) {
    if (!isConnected) return;
    const result = await changePlan({
      planId,
      successUrl: `${window.location.origin}/usage?checkout=success&changePlan=${encodeURIComponent(planId)}`,
      cancelUrl: `${window.location.origin}/usage?checkout=cancel`,
      ...timing,
    });
    if (result.checkoutUrl) {
      redirectToCheckout(result.checkoutUrl);
      return;
    }
    await reload();
    sessionBilling?.reload();
    const plans = state.status === "ready" ? state.plans : [];
    const targetPlan = plans.find((p) => p.id === planId);
    setError(
      targetPlan && isUsagePlan(targetPlan)
        ? "Plan updated. Add a payment method in Settings → Billing for pay-per-use auto-debit."
        : "Plan updated."
    );
  }

  async function onSubscribe(planId: string) {
    if (!isConnected) {
      setError("Sign in to subscribe.");
      return;
    }
    setError(null);
    setBusyPlanId(planId);
    try {
      const plans = state.status === "ready" ? state.plans : [];
      const targetPlan = plans.find((p) => p.id === planId);
      const liveSub = state.status === "ready" ? state.subscription : null;
      const subscriptionUi = deriveBillingSubscriptionUiState(liveSub);
      const action = deriveBillingPlanAction(subscriptionUi, planId);
      const hasActiveSubscription = subscriptionUi.kind !== "none";

      if (action === "current") {
        setBusyPlanId(null);
        return;
      }

      if (hasActiveSubscription && targetPlan?.isStarterDefault === true) {
        setBusyPlanId(null);
        openChangeTimingDialog(planId);
        return;
      }

      // Starter/default users already have a subscription — switch instead of
      // create, so pay-per-use can still collect a setup Checkout card.
      try {
        if (hasActiveSubscription) {
          await runChangePlan(planId);
        } else {
          const result = await subscribe({
            planId,
            successUrl: `${window.location.origin}/usage?checkout=success&changePlan=${encodeURIComponent(planId)}`,
            cancelUrl: `${window.location.origin}/usage?checkout=cancel`,
          });
          if (result.checkoutUrl) {
            redirectToCheckout(result.checkoutUrl);
            return;
          }
          await reload();
          sessionBilling?.reload();
          setError(
            targetPlan && isUsagePlan(targetPlan)
              ? "Plan updated. Add a payment method in Settings → Billing for pay-per-use auto-debit."
              : "Plan updated."
          );
        }
      } catch (err) {
        if (err instanceof ScheduledChangeConflictError) {
          openChangeTimingDialog(planId, err.conflict);
          return;
        }
        throw err;
      }
      setBusyPlanId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusyPlanId(null);
    }
  }

  async function onConfirmChangeTiming() {
    if (!isConnected || !changeDialog) return;
    setError(null);
    setBusyPlanId(changeDialog.planId);
    try {
      const payload = resolveTimingPayload({
        choice: changeChoice,
        customDateYmd: changeCustomDate,
      });
      await runChangePlan(changeDialog.planId, {
        ...payload,
        ...(changeDialog.conflict ? { confirmReplaceScheduled: true } : {}),
      });
      setChangeDialog(null);
    } catch (err) {
      if (err instanceof ScheduledChangeConflictError) {
        openChangeTimingDialog(changeDialog.planId, err.conflict);
        return;
      }
      setError(
        err instanceof Error ? err.message : "Could not change subscription"
      );
    } finally {
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

  if (state.plans.length === 0) {
    return null;
  }

  const subscriptionUiState = deriveBillingSubscriptionUiState(
    state.subscription
  );
  const hasActiveSubscription = subscriptionUiState.kind !== "none";
  const planSub =
    included && !included.sharedWithApp
      ? includedUsageRemainingLabel(included)
      : state.subscription?.planName?.trim() ||
        (subscriptionUiState.kind === "pending"
          ? "Payment needs to be completed"
          : subscriptionUiState.kind === "active"
            ? "Current subscription"
            : "Subscribe via PymtHouse → Stripe Checkout");

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="border-b border-hairline px-4 py-3.5">
        <p className="text-[17px] font-bold text-fg">Plans</p>
        <p className="mt-0.5 text-[12px] text-fg-muted">{planSub}</p>
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
          const action = deriveBillingPlanAction(subscriptionUiState, plan.id);
          const isCurrent = action === "current";
          return (
            <li
              key={plan.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-fg">
                  {plan.name || plan.id}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-fg-faint">
                  {formatPrice(plan)}
                  {plan.capabilityCount > 0
                    ? ` · ${plan.capabilityCount} capabilities`
                    : ""}
                </p>
                {isCurrent &&
                included &&
                !included.sharedWithApp &&
                included.planId === plan.id ? (
                  <p className="mt-1 text-[11px] text-fg-muted">
                    ${included.remainingUsd} of ${included.totalUsd} included
                    left
                  </p>
                ) : null}
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
                  disabled={!isConnected || busyPlanId === plan.id}
                  onClick={() => void onSubscribe(plan.id)}
                >
                  {busyPlanId === plan.id
                    ? "Redirecting…"
                    : plan.isStarterDefault
                      ? hasActiveSubscription && !isCurrent
                        ? "Switch to Starter"
                        : "Choose Starter"
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
        <p className="border-t border-hairline px-4 py-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}

      <Dialog
        open={changeDialog !== null}
        onClose={() => {
          if (busyPlanId === null) setChangeDialog(null);
        }}
        maxWidth="max-w-[420px]"
      >
        <TimingChoicePanel
          title={
            changeDialog?.conflict
              ? "Replace scheduled plan change?"
              : "Switch to Starter"
          }
          description={
            changeDialog?.conflict
              ? "A plan change is already scheduled. Choosing a start time replaces that schedule with your new plan."
              : "Choose when the switch to Starter should take effect."
          }
          options={
            changeDialog?.conflict?.timingOptions ??
            state.subscription?.timingOptions?.change
          }
          choice={changeChoice}
          customDate={changeCustomDate}
          confirmLabel="Confirm switch"
          busy={busyPlanId !== null}
          onChoice={setChangeChoice}
          onCustomDate={setChangeCustomDate}
          onConfirm={() => void onConfirmChangeTiming()}
          onClose={() => setChangeDialog(null)}
        />
      </Dialog>
    </div>
  );
}
