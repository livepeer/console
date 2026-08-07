export type BillingSubscriptionSnapshot = {
  planId: string | null;
  status: string | null;
};

export type BillingSubscriptionUiState =
  | { kind: "none"; planId: null }
  | { kind: "active"; planId: string }
  | { kind: "pending"; planId: string };

export type BillingPlanAction =
  | "subscribe"
  | "change_plan"
  | "retry_checkout"
  | "current";

const ACTIVE_STATUSES = new Set(["active", "trialing", "scheduled"]);
const PENDING_STATUSES = new Set([
  "pending",
  "incomplete",
  "incomplete_expired",
  "checkout_pending",
]);

export function deriveBillingSubscriptionUiState(
  subscription: BillingSubscriptionSnapshot | null | undefined
): BillingSubscriptionUiState {
  const planId = subscription?.planId?.trim() || null;
  if (!planId) {
    return { kind: "none", planId: null };
  }

  const status = subscription?.status?.trim().toLowerCase() || "";
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
  return subscription.planId === planId ? "current" : "change_plan";
}

export function billingPlanActionLabel(action: BillingPlanAction): string {
  switch (action) {
    case "current":
      return "Current plan";
    case "change_plan":
      return "Switch";
    case "retry_checkout":
      return "Complete payment";
    case "subscribe":
      return "Subscribe";
  }
}

export function isActiveSubscriptionConflict(message: string): boolean {
  return /already has an active subscription/i.test(message);
}
