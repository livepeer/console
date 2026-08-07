"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Box,
  Check,
  CreditCard,
  Download,
  Plus,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  IconButton,
  SettingsCard,
  SettingsHeader,
  ST_COLS_5,
  ST_HEAD_CLASS,
} from "./SettingsPrimitives";
import { useBillingPlans } from "@/lib/dashboard/useBillingPlans";
import { useBillingAccount } from "@/lib/dashboard/useBillingAccount";
import type { DashboardBillingPlan } from "@/lib/dashboard/pymthouse-billing-bff";
import {
  billingPlanActionLabel,
  deriveBillingPlanAction,
  deriveBillingSubscriptionUiState,
  isActiveSubscriptionConflict,
  type BillingPlanAction,
} from "@/lib/dashboard/billing-subscription-state";

function formatPlanPrice(
  amount: string,
  currency: string,
  cycle: string | null
): { price: string; priceSub: string } {
  const n = Number(amount);
  const money = Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: n % 1 === 0 ? 0 : 2,
      }).format(n)
    : amount;
  const c = cycle?.toLowerCase() ?? "";
  if (c === "monthly" || c === "month")
    return { price: money, priceSub: " / month" };
  if (c === "yearly" || c === "year" || c === "annual") {
    return { price: money, priceSub: " / year" };
  }
  return { price: money, priceSub: cycle ? ` · ${cycle}` : "" };
}

function formatInvoiceAmount(totalAmount: string, currency: string): string {
  const n = Number(totalAmount);
  if (!Number.isFinite(n)) return `${totalAmount} ${currency}`;
  // OpenMeter invoice totals are decimal dollar strings (e.g. "2.50").
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(n);
}

function formatInvoiceDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

/**
 * Organization · Billing — live plan, payment method, and invoices.
 * Fake company/tax/address “Billing details” removed (no API).
 */
export default function BillingSection() {
  const { user } = useAuth();
  const externalUserId = user?.id?.trim();
  const {
    state: plansState,
    reload: reloadPlans,
    subscribe,
    changePlan,
  } = useBillingPlans(externalUserId);
  const {
    state: accountState,
    reload: reloadAccount,
    startPaymentMethodCheckout,
    openInvoice,
    setDefaultPaymentMethod,
    removePaymentMethod,
  } = useBillingAccount(externalUserId);

  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [pmBusy, setPmBusy] = useState(false);
  const [paymentMethodActionId, setPaymentMethodActionId] = useState<
    string | null
  >(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [flash, setFlash] = useState<"success" | "cancel" | null>(null);

  useEffect(() => {
    const next = readCheckoutFlash();
    if (!next) return;
    setFlash(next);
    clearCheckoutQueryParam();
    if (next === "success") {
      void reloadPlans();
      void reloadAccount();
    }
  }, [reloadPlans, reloadAccount]);

  async function onPlanAction(planId: string, action: BillingPlanAction) {
    if (!externalUserId) {
      setError("Sign in to subscribe.");
      return;
    }
    if (action === "current") {
      return;
    }

    setError(null);
    setBillingNotice(null);
    setBusyPlanId(planId);
    try {
      const input = {
        planId:
          action === "retry_checkout"
            ? (subscriptionUiState.planId ?? planId)
            : planId,
        externalUserId,
        successUrl: `${window.location.origin}/settings?tab=billing&checkout=success`,
        cancelUrl: `${window.location.origin}/settings?tab=billing&checkout=cancel`,
      };
      const result =
        action === "change_plan"
          ? await changePlan(input)
          : await subscribe(input);

      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      await reloadPlans();
      setBillingNotice("Your plan has been updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      if (isActiveSubscriptionConflict(message)) {
        setBillingNotice(
          "You already have a subscription. Choose another plan to switch, or complete payment for your current plan."
        );
        await reloadPlans();
      } else {
        setError(message);
      }
    } finally {
      setBusyPlanId(null);
    }
  }

  async function onAddCard() {
    if (!externalUserId) {
      setError("Sign in to add a payment method.");
      return;
    }
    setError(null);
    setPmBusy(true);
    try {
      const { checkoutUrl } = await startPaymentMethodCheckout({
        externalUserId,
      });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment method checkout failed"
      );
      setPmBusy(false);
    }
  }

  async function onOpenInvoice(invoiceId: string, prefer: "hosted" | "pdf") {
    if (!externalUserId) return;
    setError(null);
    setInvoiceBusyId(invoiceId);
    try {
      const links = await openInvoice({ externalUserId, invoiceId });
      const url =
        prefer === "pdf"
          ? links.invoicePdf || links.hostedInvoiceUrl
          : links.hostedInvoiceUrl || links.invoicePdf;
      if (!url) {
        throw new Error("No Stripe invoice page for this invoice yet.");
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open invoice");
    } finally {
      setInvoiceBusyId(null);
    }
  }

  async function onSetDefaultPaymentMethod(paymentMethodId: string) {
    if (!externalUserId) return;
    setError(null);
    setPaymentMethodActionId(paymentMethodId);
    try {
      await setDefaultPaymentMethod({ externalUserId, paymentMethodId });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not set default payment method"
      );
    } finally {
      setPaymentMethodActionId(null);
    }
  }

  async function onRemovePaymentMethod(paymentMethodId: string) {
    if (!externalUserId) return;
    if (!window.confirm("Remove this payment method?")) return;
    setError(null);
    setPaymentMethodActionId(paymentMethodId);
    try {
      await removePaymentMethod({ externalUserId, paymentMethodId });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove payment method"
      );
    } finally {
      setPaymentMethodActionId(null);
    }
  }

  const plansLoading =
    plansState.status === "loading" || plansState.status === "idle";
  const accountLoading =
    accountState.status === "loading" || accountState.status === "idle";

  const plans = plansState.status === "ready" ? plansState.plans : [];
  const subscription =
    plansState.status === "ready" ? plansState.subscription : null;
  const subscriptionUiState = deriveBillingSubscriptionUiState(subscription);
  const paymentMethods =
    accountState.status === "ready" ? accountState.paymentMethods : [];
  const invoices = accountState.status === "ready" ? accountState.invoices : [];

  const planSub =
    subscription?.planName?.trim() ||
    (subscriptionUiState.kind === "pending"
      ? "Payment needs to be completed"
      : subscriptionUiState.kind === "active"
        ? "Current subscription"
        : "Choose a plan to get started");

  return (
    <div>
      {flash === "success" ? (
        <p className="mb-4 text-[13px] text-emerald-400">
          Checkout completed — billing details refreshed.
        </p>
      ) : null}
      {flash === "cancel" ? (
        <p className="mb-4 text-[13px] text-fg-muted">Checkout canceled.</p>
      ) : null}
      {billingNotice ? (
        <p className="mb-4 text-[13px] text-green-bright" role="status">
          {billingNotice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 text-[13px] text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <SettingsHeader title="Plan" sub={planSub} />
      <SettingsCard>
        {plansLoading ? (
          <div className="animate-pulse p-[18px]">
            <div className="h-4 w-40 rounded bg-white/5" />
            <div className="mt-3 h-24 rounded bg-white/5" />
          </div>
        ) : plansState.status === "error" ? (
          <div className="p-[18px]">
            <p className="text-[13px] text-fg-muted">Could not load plans.</p>
            <p className="mt-1 font-mono text-[12px] text-fg-faint">
              {plansState.message}
            </p>
            <button
              type="button"
              className="mt-3 text-[12.5px] text-fg-strong underline"
              onClick={() => void reloadPlans()}
            >
              Retry
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="px-5 py-9 text-center">
            <p className="text-[13.5px] text-fg-muted">
              No paid plans are published for this app yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3">
            {plans.map((plan, index) => {
              const action = deriveBillingPlanAction(
                subscriptionUiState,
                plan.id
              );
              const isCurrent = action === "current";
              const isPending =
                subscriptionUiState.kind === "pending" &&
                subscriptionUiState.planId === plan.id;
              const { price, priceSub } = formatPlanPrice(
                plan.priceAmount,
                plan.priceCurrency,
                plan.billingCycle
              );
              const features = [
                plan.billingCycle
                  ? `${plan.billingCycle} billing`
                  : "Usage-based billing",
                plan.capabilityCount > 0
                  ? `${plan.capabilityCount} capabilities`
                  : "All included capabilities",
              ];
              return (
                <LivePlanCard
                  key={plan.id}
                  plan={plan}
                  price={price}
                  priceSub={priceSub}
                  features={features}
                  isCurrent={isCurrent}
                  isPending={isPending}
                  isLast={index === plans.length - 1}
                  busy={busyPlanId === plan.id}
                  disabled={
                    action === "current" ||
                    !externalUserId ||
                    busyPlanId !== null
                  }
                  action={action}
                  onSelect={() => void onPlanAction(plan.id, action)}
                />
              );
            })}
          </div>
        )}
      </SettingsCard>

      <SettingsHeader
        title="Payment method"
        sub="Card on file for subscription and usage charges"
        action={
          <IconButton
            primary
            onClick={() => void onAddCard()}
            disabled={pmBusy || !externalUserId}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {pmBusy ? "Starting…" : "Add card"}
          </IconButton>
        }
      />
      <SettingsCard>
        {accountLoading ? (
          <div className="animate-pulse px-5 py-9">
            <div className="mx-auto h-5 w-40 rounded bg-white/5" />
          </div>
        ) : accountState.status === "error" ? (
          <div className="px-5 py-6 text-center">
            <p className="text-[13px] text-fg-muted">
              Could not load payment methods.
            </p>
            <button
              type="button"
              className="mt-2 text-[12.5px] text-fg-strong underline"
              onClick={() => void reloadAccount()}
            >
              Retry
            </button>
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="px-5 py-9 text-center">
            <Box
              className="mx-auto h-[22px] w-[22px] text-fg-disabled"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="mt-2 text-[13.5px] font-medium text-fg">
              No payment method
            </p>
            <p className="mt-1 text-[12.5px] text-fg-faint">
              Add a card via Stripe Checkout. Completing Checkout updates your
              card on file even if you do not return to this page.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {paymentMethods.map((pm) => {
              const isBusy = paymentMethodActionId === pm.id;
              return (
                <li key={pm.id} className="flex items-center gap-3 px-5 py-3.5">
                  <CreditCard
                    className="h-4 w-4 shrink-0 text-fg-faint"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-fg">
                      {(pm.brand || pm.type || "Card").toUpperCase()}
                      {pm.last4 ? ` ···· ${pm.last4}` : ""}
                    </p>
                    <p className="text-[12px] text-fg-faint">
                      {pm.expMonth && pm.expYear
                        ? `Expires ${String(pm.expMonth).padStart(2, "0")}/${pm.expYear}`
                        : pm.type}
                      {pm.isDefault ? " · Default" : ""}
                    </p>
                  </div>
                  {!pm.isDefault ? (
                    <button
                      type="button"
                      className="text-[12px] text-green-bright transition-colors hover:text-fg disabled:opacity-50"
                      disabled={paymentMethodActionId !== null}
                      onClick={() => void onSetDefaultPaymentMethod(pm.id)}
                    >
                      {isBusy ? "Saving…" : "Set default"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-faint transition-colors hover:bg-white/5 hover:text-red-400 disabled:opacity-50"
                    disabled={paymentMethodActionId !== null}
                    onClick={() => void onRemovePaymentMethod(pm.id)}
                    aria-label={`Remove ${(pm.brand || pm.type || "payment method").toLowerCase()} ending ${pm.last4 ?? ""}`}
                    title="Remove payment method"
                  >
                    {isBusy ? (
                      "…"
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      <SettingsHeader title="Invoices" sub="Stripe invoices for this account" />
      <SettingsCard>
        {accountLoading ? (
          <div className="animate-pulse p-5">
            <div className="h-4 w-full rounded bg-white/5" />
          </div>
        ) : accountState.status === "error" ? (
          <div className="px-5 py-6 text-center">
            <p className="text-[13px] text-fg-muted">
              Could not load invoices.
            </p>
            <button
              type="button"
              className="mt-2 text-[12.5px] text-fg-strong underline"
              onClick={() => void reloadAccount()}
            >
              Retry
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-5 py-9 text-center">
            <p className="text-[13.5px] text-fg-muted">No invoices yet.</p>
          </div>
        ) : (
          <>
            <div className={`${ST_COLS_5} ${ST_HEAD_CLASS}`}>
              <span>Invoice</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span aria-hidden="true" />
            </div>
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className={`${ST_COLS_5} border-b border-hairline last:border-b-0 transition-colors hover:bg-zebra`}
              >
                <div className="font-mono text-[12.5px] text-fg">
                  {inv.number?.trim() || inv.id}
                </div>
                <div className="text-[12.5px] text-fg-faint">
                  {formatInvoiceDate(inv.issuedAt || inv.periodStart)}
                </div>
                <div className="font-mono text-[12.5px] text-fg">
                  {formatInvoiceAmount(inv.totalAmount, inv.currency)}
                </div>
                <div className="text-[12px] capitalize text-fg-faint">
                  {inv.status}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="text-[12px] text-fg-strong transition-colors hover:text-fg disabled:opacity-50"
                    disabled={invoiceBusyId === inv.id}
                    onClick={() => void onOpenInvoice(inv.id, "hosted")}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] text-fg-strong transition-colors hover:text-fg disabled:opacity-50"
                    disabled={invoiceBusyId === inv.id}
                    onClick={() => void onOpenInvoice(inv.id, "pdf")}
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </SettingsCard>
    </div>
  );
}

function LivePlanCard({
  plan,
  price,
  priceSub,
  features,
  isCurrent,
  isPending,
  isLast,
  busy,
  disabled,
  action,
  onSelect,
}: {
  plan: DashboardBillingPlan;
  price: string;
  priceSub: string;
  features: string[];
  isCurrent: boolean;
  isPending: boolean;
  isLast: boolean;
  busy: boolean;
  disabled: boolean;
  action: BillingPlanAction;
  onSelect: () => void;
}) {
  const isHighlighted = isCurrent || isPending;
  return (
    <div
      className={`relative p-[18px] ${
        isLast ? "" : "border-b border-hairline md:border-b-0 md:border-r"
      }`}
      style={
        isHighlighted
          ? {
              background:
                "linear-gradient(180deg, rgba(64, 191, 134, 0.06), transparent)",
            }
          : undefined
      }
    >
      {isHighlighted ? (
        <span
          className="absolute top-0 bottom-0 left-0 w-[2px] bg-green"
          aria-hidden="true"
        />
      ) : null}
      {isCurrent ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-green-bright">
          Current plan
        </p>
      ) : null}
      {isPending ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-amber-300">
          Payment pending
        </p>
      ) : null}
      <p
        className={`text-[16px] font-medium text-fg ${isHighlighted ? "mt-1" : ""}`}
      >
        {plan.name}
      </p>
      <p className="mt-1 text-[13px] text-fg-strong">
        <span className="text-[22px] font-medium tracking-[-0.01em] text-fg">
          {price}
        </span>
        <span className="text-fg-faint">{priceSub}</span>
      </p>
      <ul className="mt-3.5 flex flex-col gap-1.5">
        {features.map((line) => (
          <li
            key={line}
            className="flex items-center gap-1.5 text-[12.5px] text-fg-strong"
          >
            <Check
              className="h-3 w-3 shrink-0 text-green-bright"
              aria-hidden="true"
            />
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={`mt-4 inline-flex h-7 items-center gap-1 rounded-[4px] border px-3 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
          action === "current"
            ? "border-subtle bg-transparent text-fg-muted"
            : "btn-primary"
        }`}
      >
        {busy ? "Working…" : billingPlanActionLabel(action)}
        {action !== "current" && !busy ? (
          <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
        ) : null}
      </button>
    </div>
  );
}
