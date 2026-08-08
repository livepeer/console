export type PendingCancelSnapshot = {
  subscriptionId?: string;
  planId?: string | null;
  planName?: string | null;
  effectiveAt?: string | null;
};

export type BillingSubscriptionSnapshot = {
  planId: string | null;
  status: string | null;
  currentPeriodEnd?: string | null;
  pendingCancel?: PendingCancelSnapshot | null;
  timingOptions?: {
    cancel: SubscriptionTimingOptions;
    change: SubscriptionTimingOptions;
  } | null;
};

export type SubscriptionTimingOptions = {
  minEffectiveAt: string;
  maxEffectiveAt: string | null;
  presets: Array<"immediate" | "next_billing_cycle">;
};

export type BillingSubscriptionUiState =
  | { kind: "none"; planId: null }
  | { kind: "active"; planId: string }
  | { kind: "pending"; planId: string }
  | { kind: "canceling"; planId: string };

export type BillingPlanAction =
  | "subscribe"
  | "change_plan"
  | "retry_checkout"
  | "current";

export type SubscriptionTimingChoice =
  | "immediate"
  | "next_billing_cycle"
  | "custom";

const ACTIVE_STATUSES = new Set(["active", "trialing", "scheduled"]);
const PENDING_STATUSES = new Set([
  "pending",
  "incomplete",
  "incomplete_expired",
  "checkout_pending",
]);
/** Includes Konnect `inactive` (cancel-at-period-end still occupying the slot). */
const CANCELED_STATUSES = new Set(["canceled", "cancelled", "inactive"]);

/** Sentinel when cancel-at-period-end is known but local plan id is missing. */
const CANCELING_PLAN_FALLBACK = "__canceling__";

/**
 * pendingCancel that actually applies to the live subscription.
 *
 * Upstream reports any occupying canceled OpenMeter row, so a cancel scheduled
 * on a plan the user has since switched away from keeps being returned. That
 * stale row must not drive canceling UI or the resume CTA — resume would 4xx
 * because there is no scheduled cancellation left to undo.
 */
export function resolveApplicablePendingCancel(
  subscription:
    | {
        planId?: string | null;
        pendingCancel?: PendingCancelSnapshot | null;
      }
    | null
    | undefined
): PendingCancelSnapshot | null {
  const pending = subscription?.pendingCancel;
  if (!pending) return null;
  const activePlanId = subscription?.planId?.trim();
  const pendingPlanId = pending.planId?.trim();
  if (activePlanId && pendingPlanId && activePlanId !== pendingPlanId) {
    return null;
  }
  return pending;
}

export function deriveBillingSubscriptionUiState(
  subscription: BillingSubscriptionSnapshot | null | undefined
): BillingSubscriptionUiState {
  const pending = resolveApplicablePendingCancel(subscription);
  const planId =
    subscription?.planId?.trim() || pending?.planId?.trim() || null;
  const status = subscription?.status?.trim().toLowerCase() || "";
  const isCanceling = Boolean(pending) || CANCELED_STATUSES.has(status);

  // Cancel-at-period-end still owns the OpenMeter customer until effectiveAt /
  // currentPeriodEnd — surface that even when planId is only on pendingCancel.
  if (isCanceling) {
    return { kind: "canceling", planId: planId || CANCELING_PLAN_FALLBACK };
  }

  if (!planId) {
    return { kind: "none", planId: null };
  }

  if (PENDING_STATUSES.has(status)) {
    return { kind: "pending", planId };
  }
  if (ACTIVE_STATUSES.has(status)) {
    return { kind: "active", planId };
  }

  return { kind: "none", planId: null };
}

export function deriveBillingPlanAction(
  subscription: BillingSubscriptionUiState,
  planId: string
): BillingPlanAction {
  if (subscription.kind === "none") {
    return "subscribe";
  }
  if (subscription.kind === "pending") {
    return "retry_checkout";
  }
  // canceling still treats current plan as current; other plans can switch/upgrade
  return subscription.planId === planId ? "current" : "change_plan";
}

export function billingPlanActionLabel(
  action: BillingPlanAction,
  opts?: { usagePlan?: boolean },
): string {
  switch (action) {
    case "current":
      return "Current plan";
    case "change_plan":
      return opts?.usagePlan ? "Enable pay-per-use" : "Switch";
    case "retry_checkout":
      return "Complete payment";
    case "subscribe":
      return opts?.usagePlan ? "Enable pay-per-use" : "Subscribe";
  }
}

export function isActiveSubscriptionConflict(message: string): boolean {
  return /already has an active subscription/i.test(message);
}

export function isScheduledChangeConflict(code: string | undefined): boolean {
  return code === "scheduled_change_exists";
}

/**
 * End date for cancel-at-period-end, from builder/OpenMeter
 * (`pendingCancel.effectiveAt` or subscription `currentPeriodEnd`).
 */
export function resolveCancelingEffectiveAt(
  subscription: BillingSubscriptionSnapshot | null | undefined
): string | null {
  return (
    resolveApplicablePendingCancel(subscription)?.effectiveAt?.trim() ||
    subscription?.currentPeriodEnd?.trim() ||
    null
  );
}

/** Human plan label for the canceling banner / restore CTA. */
export function resolveCancelingPlanName(
  subscription: {
    planId?: string | null;
    planName?: string | null;
    pendingCancel?: PendingCancelSnapshot | null;
  } | null | undefined
): string {
  return (
    resolveApplicablePendingCancel(subscription)?.planName?.trim() ||
    subscription?.planName?.trim() ||
    "your plan"
  );
}

/**
 * Upstream answers resume with `404 { code: "nothing_to_resume" }` when there
 * is no scheduled cancellation left to undo. The local snapshot is simply
 * stale, so reconcile instead of surfacing an error.
 *
 * Keyed on the code alone, never on the status class: the sibling resume
 * branches (`confirm_required` 400, `resume_failed` 502, `openmeter_unavailable`
 * 503) and any auth failure are real errors the user must see.
 */
export function isNothingToResumeError(code: string | undefined): boolean {
  return code === "nothing_to_resume";
}

export function formatPendingCancelDate(
  iso: string | null | undefined
): string {
  if (!iso) return "the end of this period";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the end of this period";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** YYYY-MM-DD for `<input type="date">` min/max (UTC calendar day). */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Noon UTC on the chosen calendar day — stable for Konnect ISO timing. */
export function dateInputToEffectiveAtIso(dateYmd: string): string {
  const [y, m, d] = dateYmd.split("-").map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) {
    throw new Error("Invalid date");
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)).toISOString();
}

export function defaultCancelTimingChoice(): SubscriptionTimingChoice {
  return "next_billing_cycle";
}

export function resolveTimingPayload(input: {
  choice: SubscriptionTimingChoice;
  customDateYmd: string;
}): { timing?: "immediate" | "next_billing_cycle"; effectiveAt?: string } {
  if (input.choice === "immediate") return { timing: "immediate" };
  if (input.choice === "next_billing_cycle") {
    return { timing: "next_billing_cycle" };
  }
  return { effectiveAt: dateInputToEffectiveAtIso(input.customDateYmd) };
}
