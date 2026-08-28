import type {
  DashboardBillingPlan,
  DashboardUserSubscription,
} from "@/lib/console/pymthouse-billing";

/** Platform-wide Owner Starter plan key (shared across all owner wallets). */
export const OWNER_STARTER_PLAN_KEY = "pymthouse_owner_starter";

export const OWNER_STARTER_PLAN_NAME = "Owner Sandbox Starter";

/** Prefix for Owner Paid tiers (`pymthouse_owner_paid` or `pymthouse_owner_paid_*`). */
export const OWNER_PAID_PLAN_KEY_PREFIX = "pymthouse_owner_paid";

/** PymtHouse rejects app-retail mutations that would hit the owner wallet. */
export const OWNER_WALLET_NOT_APP_USER = "owner_wallet_not_app_user";

export function isOwnerStarterPlanKey(
  planKey: string | null | undefined
): boolean {
  const key = planKey?.trim();
  if (!key) return false;
  const base = OWNER_STARTER_PLAN_KEY.toLowerCase();
  const lower = key.toLowerCase();
  if (lower === base) return true;
  const prefix = `${base}_`;
  if (!lower.startsWith(prefix)) return false;
  return /^\d+$/.test(lower.slice(prefix.length));
}

export function isOwnerPaidPlanKey(
  planKey: string | null | undefined
): boolean {
  const key = planKey?.trim().toLowerCase();
  if (!key) return false;
  if (key === OWNER_PAID_PLAN_KEY_PREFIX) return true;
  return key.startsWith(`${OWNER_PAID_PLAN_KEY_PREFIX}_`);
}

/** True when the live OpenMeter plan is the shared owner wallet, not app retail. */
export function isOwnerWalletPlanKey(
  planKey: string | null | undefined
): boolean {
  return isOwnerStarterPlanKey(planKey) || isOwnerPaidPlanKey(planKey);
}

/**
 * Catalog id for an owner-wallet OpenMeter key. Amount-suffixed Starter
 * variants collapse onto the shared Starter row.
 */
export function catalogPlanIdForOwnerKey(
  planKey: string | null | undefined
): string | null {
  const key = planKey?.trim();
  if (!key) return null;
  if (isOwnerStarterPlanKey(key)) return OWNER_STARTER_PLAN_KEY;
  if (isOwnerPaidPlanKey(key)) return key;
  return null;
}

export type OwnerPaidTierSeed = {
  key: string;
  name: string;
  monthlyFeeUsd: string;
  includedUsdMicros: string;
  sortOrder: number;
};

export function mapOwnerCatalogPlans(
  tiers: ReadonlyArray<OwnerPaidTierSeed>
): DashboardBillingPlan[] {
  const starter: DashboardBillingPlan = {
    id: OWNER_STARTER_PLAN_KEY,
    name: OWNER_STARTER_PLAN_NAME,
    type: "free",
    status: "active",
    priceAmount: "0",
    priceCurrency: "USD",
    billingCycle: "monthly",
    includedUsdMicros: null,
    chargeThresholdUsdMicros: null,
    resolvedBehavior: null,
    capabilityCount: 0,
    isStarterDefault: true,
  };
  const paid = [...tiers]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
      (tier): DashboardBillingPlan => ({
        id: tier.key,
        name: tier.name.trim() || tier.key,
        type: "subscription",
        status: "active",
        priceAmount: tier.monthlyFeeUsd,
        priceCurrency: "USD",
        billingCycle: "monthly",
        includedUsdMicros: tier.includedUsdMicros,
        chargeThresholdUsdMicros: null,
        resolvedBehavior: null,
        capabilityCount: 0,
        isStarterDefault: false,
      })
    );
  return [starter, ...paid];
}

export type OwnerSubscriptionStatusSeed = {
  livePaidPlanKey: string | null;
  pendingDowngrade: {
    subscriptionId?: string;
    planId?: string | null;
    planKey?: string | null;
    planName?: string | null;
    effectiveAt?: string | null;
  } | null;
  subscriptions: Array<{
    subscriptionId: string;
    status: string;
    planName: string;
    openMeterPlanKey: string | null;
    activeTo: string | null;
  }>;
};

export function mapOwnerUserSubscription(
  status: OwnerSubscriptionStatusSeed
): DashboardUserSubscription {
  const livePaidKey = status.livePaidPlanKey?.trim() || null;
  const liveRow =
    status.subscriptions.find((row) => {
      const key = row.openMeterPlanKey?.trim() || "";
      if (livePaidKey) return key === livePaidKey;
      return isOwnerStarterPlanKey(key);
    }) ??
    status.subscriptions[0] ??
    null;
  const liveKey = liveRow?.openMeterPlanKey?.trim() || livePaidKey;
  const planId = catalogPlanIdForOwnerKey(liveKey);
  const pending = status.pendingDowngrade;
  return {
    planId,
    planName:
      liveRow?.planName?.trim() ||
      (planId === OWNER_STARTER_PLAN_KEY
        ? OWNER_STARTER_PLAN_NAME
        : livePaidKey),
    status: liveRow?.status?.trim() || (planId ? "active" : null),
    subscriptionId: liveRow?.subscriptionId?.trim() || null,
    currentPeriodEnd: liveRow?.activeTo?.trim() || null,
    timingOptions: null,
    pendingCancel: pending
      ? {
          subscriptionId:
            pending.subscriptionId?.trim() || liveRow?.subscriptionId || "",
          planId: pending.planId?.trim() || planId,
          planKey: pending.planKey?.trim() || null,
          planName: pending.planName?.trim() || OWNER_STARTER_PLAN_NAME,
          effectiveAt: pending.effectiveAt?.trim() || null,
        }
      : null,
  };
}
