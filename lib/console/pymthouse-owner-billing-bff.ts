import "server-only";

import {
  PmtHouseError,
  readAccessTokenBillingMode,
} from "@pymthouse/builder-sdk";

import { mintEndUserAccessToken } from "@/lib/console/pymthouse-bff";
import type {
  DashboardSubscriptionChange,
  DashboardUserSubscription,
} from "@/lib/console/pymthouse-billing";
import {
  pymthouseAppsOrigin,
  readM2mAuthHeader,
  readPublicClientId,
  readPymthouseResponse,
} from "@/lib/console/pymthouse-http";
import {
  isOwnerStarterPlanKey,
  isOwnerWalletPlanKey,
  OWNER_WALLET_NOT_APP_USER,
} from "@/lib/console/owner-billing-rail";

export {
  mapOwnerCatalogPlans,
  mapOwnerUserSubscription,
} from "@/lib/console/owner-billing-rail";

export type SessionBillingRail = "owner" | "retail";

type AppUserSubscriptionWire = {
  subscription?: {
    id?: string | null;
    status?: string | null;
    planId?: string | null;
    planName?: string | null;
    openmeterPlanKey?: string | null;
    currentPeriodEnd?: string | null;
  } | null;
  pendingCancel?: {
    subscriptionId: string;
    planId?: string | null;
    planKey?: string | null;
    planName?: string | null;
    effectiveAt?: string | null;
  } | null;
  timingOptions?: DashboardUserSubscription["timingOptions"];
};

export type OwnerPaidTierPublic = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyFeeUsd: string;
  includedUsdMicros: string;
  overageRateUsd: string | null;
  sortOrder: number;
  active: boolean;
};

export type OwnerSubscriptionSwitchingStatus = {
  ownerUserId: string;
  hasChargeablePaymentMethod: boolean | null;
  livePaidPlanKey: string | null;
  eligibleForPaidUpgrade: boolean;
  canChangePaidPlan: boolean;
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
    activeFrom: string | null;
    activeTo: string | null;
  }>;
};

type OwnerPaidMutationResult = {
  openmeterSubscriptionId?: string;
  planKey?: string;
  effectiveAt?: string | null;
  alreadyPaid?: boolean;
  alreadyStarter?: boolean;
  alreadyScheduled?: boolean;
};

async function ownerBillingFetch<T>(
  path: string,
  init?: { method?: string; body?: Record<string, unknown> }
): Promise<T> {
  const publicClientId = readPublicClientId();
  const method = init?.method ?? "GET";
  const response = await fetch(
    `${pymthouseAppsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/billing${path}`,
    {
      method,
      headers: {
        Authorization: readM2mAuthHeader(),
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
    }
  );
  return readPymthouseResponse<T>(response);
}

async function fetchM2mUserSubscription(
  externalUserId: string
): Promise<AppUserSubscriptionWire> {
  const publicClientId = readPublicClientId();
  const response = await fetch(
    `${pymthouseAppsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/users/${encodeURIComponent(externalUserId)}/subscription`,
    {
      method: "GET",
      headers: {
        Authorization: readM2mAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );
  return readPymthouseResponse<AppUserSubscriptionWire>(response);
}

export function isOwnerWalletMutationError(error: unknown): boolean {
  if (!(error instanceof PmtHouseError)) return false;
  if (error.code === OWNER_WALLET_NOT_APP_USER) return true;
  const details = error.details;
  if (details && typeof details === "object" && "code" in details) {
    return (details as { code?: unknown }).code === OWNER_WALLET_NOT_APP_USER;
  }
  return error.message.includes("cannot target the owner wallet");
}

/**
 * Owner_rollup end-users share the app owner's OpenMeter customer. Retail
 * plan APIs reject those subjects; use Owner Paid M2M instead.
 */
export async function resolveSessionBillingRail(
  externalUserId: string,
  email?: string
): Promise<SessionBillingRail> {
  try {
    const sub = await fetchM2mUserSubscription(externalUserId);
    const liveKey = sub.subscription?.openmeterPlanKey?.trim() ?? "";
    if (isOwnerWalletPlanKey(liveKey)) return "owner";
  } catch {
    // Fall through to the minted JWT claim.
  }

  try {
    const accessToken = await mintEndUserAccessToken(externalUserId, email);
    if (readAccessTokenBillingMode(accessToken) === "owner_rollup") {
      return "owner";
    }
  } catch {
    // Mint can fail for a brand-new user; default to retail catalog.
  }
  return "retail";
}

export async function listOwnerPaidTiers(): Promise<OwnerPaidTierPublic[]> {
  const body = await ownerBillingFetch<{ tiers?: OwnerPaidTierPublic[] }>(
    "/tiers"
  );
  return (body.tiers ?? []).filter((tier) => tier.active !== false);
}

export async function getOwnerSubscriptionStatus(): Promise<OwnerSubscriptionSwitchingStatus> {
  return ownerBillingFetch<OwnerSubscriptionSwitchingStatus>("/subscription");
}

function toSubscriptionChange(
  result: OwnerPaidMutationResult,
  planId: string
): DashboardSubscriptionChange {
  return {
    subscriptionId: result.openmeterSubscriptionId?.trim() || "",
    planId: result.planKey?.trim() || planId,
    effectiveAt: result.effectiveAt?.trim() || null,
    timing: result.effectiveAt ? "next_billing_cycle" : "immediate",
  };
}

export async function changeOwnerWalletPlan(input: {
  planId: string;
}): Promise<DashboardSubscriptionChange> {
  const planId = input.planId.trim();
  if (isOwnerStarterPlanKey(planId)) {
    const result = await ownerBillingFetch<OwnerPaidMutationResult>(
      "/subscription",
      { method: "DELETE", body: { confirm: true } }
    );
    return toSubscriptionChange(result, planId);
  }
  const result = await ownerBillingFetch<OwnerPaidMutationResult>(
    "/subscription",
    {
      method: "PUT",
      body: { planKey: planId, confirm: true },
    }
  );
  return toSubscriptionChange(result, planId);
}

export async function cancelOwnerWalletPlan(): Promise<void> {
  await ownerBillingFetch("/subscription", {
    method: "DELETE",
    body: { confirm: true },
  });
}

export async function resumeOwnerWalletPlan(): Promise<void> {
  await ownerBillingFetch("/subscription/pending-change", {
    method: "DELETE",
    body: { confirm: true },
  });
}
