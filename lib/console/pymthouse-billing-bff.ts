import "server-only";

import {
  PmtHouseError,
  type BillingProduct,
  type CreateAppUserPaymentMethodCheckoutResult,
  type CreateBillingCheckoutResult,
  type UserSubscriptionResponse,
} from "@pymthouse/builder-sdk";
import { createPmtHouseClientForPublicApp } from "@/lib/console/pymthouse-bff";
import type {
  DashboardBillingPlan,
  DashboardInvoice,
  DashboardInvoiceHostedUrl,
  DashboardPaymentMethod,
  DashboardScheduledChangeConflict,
  DashboardSubscriptionChange,
  DashboardUserSubscription,
} from "@/lib/console/pymthouse-billing";
import type {
  DashboardOwnerWallet,
  DashboardWalletInvoice,
  DashboardWalletPaymentMethod,
  DashboardWalletPaymentMethodCheckoutResult,
  DashboardWalletTopUpResult,
} from "@/lib/console/pymthouse-wallet";
import {
  pymthouseAppsOrigin,
  readM2mAuthHeader,
  readPublicClientId,
  readPymthouseResponse,
} from "@/lib/console/pymthouse-http";
import {
  changeOwnerWalletPlan,
  cancelOwnerWalletPlan,
  getOwnerSubscriptionStatus,
  isOwnerWalletMutationError,
  listOwnerPaidTiers,
  mapOwnerCatalogPlans,
  mapOwnerUserSubscription,
  resolveSessionBillingRail,
  resumeOwnerWalletPlan,
} from "@/lib/console/pymthouse-owner-billing-bff";
import { isOwnerWalletPlanKey } from "@/lib/console/owner-billing-rail";

export type {
  DashboardBillingPlan,
  DashboardInvoice,
  DashboardInvoiceHostedUrl,
  DashboardPaymentMethod,
  DashboardScheduledChangeConflict,
  DashboardSubscriptionChange,
  DashboardSubscriptionHistoryItem,
  DashboardUserSubscription,
} from "@/lib/console/pymthouse-billing";

export type {
  DashboardOwnerWallet,
  DashboardWalletInvoice,
  DashboardWalletPaymentMethod,
  DashboardWalletPaymentMethodCheckoutResult,
  DashboardWalletTopUpResult,
} from "@/lib/console/pymthouse-wallet";

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapProduct(product: BillingProduct): DashboardBillingPlan {
  const dynamicProduct = product as BillingProduct & {
    chargeThresholdUsdMicros?: unknown;
    resolvedBehavior?: unknown;
  };
  const isStarterDefault = product.isStarterDefault === true;
  const name = isStarterDefault
    ? "Starter"
    : product.name?.trim() || product.id;

  return {
    id: product.id,
    name,
    type: isStarterDefault ? "free" : product.type,
    status: product.status,
    priceAmount: product.priceAmount,
    priceCurrency: product.priceCurrency,
    billingCycle: product.allowance?.billingCycle ?? null,
    includedUsdMicros: readOptionalString(product.allowance?.includedUsdMicros),
    chargeThresholdUsdMicros: isStarterDefault
      ? null
      : readOptionalString(dynamicProduct.chargeThresholdUsdMicros),
    resolvedBehavior: isStarterDefault
      ? null
      : readOptionalString(dynamicProduct.resolvedBehavior),
    capabilityCount: product.capabilities?.length ?? 0,
    isStarterDefault,
  };
}

async function listRetailDashboardBillingPlans(): Promise<
  DashboardBillingPlan[]
> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const { products } = await client.listBillingProducts();
  return (products ?? [])
    .filter((p) => p.status === "active" && !p.isNetworkDefault)
    .map(mapProduct)
    .sort((a, b) => Number(b.isStarterDefault) - Number(a.isStarterDefault));
}

export async function listDashboardBillingPlans(
  externalUserId?: string
): Promise<DashboardBillingPlan[]> {
  if (externalUserId) {
    const rail = await resolveSessionBillingRail(externalUserId);
    if (rail === "owner") {
      return mapOwnerCatalogPlans(await listOwnerPaidTiers());
    }
  }
  return listRetailDashboardBillingPlans();
}

export async function startDashboardBillingCheckout(input: {
  planId: string;
  externalUserId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CreateBillingCheckoutResult | DashboardSubscriptionChange> {
  const useOwner =
    isOwnerWalletPlanKey(input.planId) ||
    (await resolveSessionBillingRail(input.externalUserId)) === "owner";
  if (useOwner) {
    return changeOwnerWalletPlan({ planId: input.planId });
  }
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  try {
    return await client.createBillingCheckout({
      planId: input.planId,
      externalUserId: input.externalUserId,
      ...(input.successUrl ? { successUrl: input.successUrl } : {}),
      ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
    });
  } catch (error) {
    if (isOwnerWalletMutationError(error)) {
      return changeOwnerWalletPlan({ planId: input.planId });
    }
    throw error;
  }
}

export async function changeDashboardBillingSubscription(input: {
  planId: string;
  externalUserId: string;
  successUrl?: string;
  cancelUrl?: string;
  timing?: string;
  effectiveAt?: string;
  confirmReplaceScheduled?: boolean;
}): Promise<DashboardSubscriptionChange> {
  const useOwner =
    isOwnerWalletPlanKey(input.planId) ||
    (await resolveSessionBillingRail(input.externalUserId)) === "owner";
  if (useOwner) {
    return changeOwnerWalletPlan({ planId: input.planId });
  }

  const publicClientId = readPublicClientId();
  try {
    const response = await fetch(
      `${pymthouseAppsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/users/${encodeURIComponent(input.externalUserId)}/subscription/change`,
      {
        method: "POST",
        headers: {
          Authorization: readM2mAuthHeader(),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: input.planId,
          ...(input.successUrl ? { successUrl: input.successUrl } : {}),
          ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
          ...(input.timing ? { timing: input.timing } : {}),
          ...(input.effectiveAt ? { effectiveAt: input.effectiveAt } : {}),
          ...(input.confirmReplaceScheduled
            ? { confirmReplaceScheduled: true }
            : {}),
        }),
        cache: "no-store",
      }
    );
    if (response.status === 409) {
      const text = await response.text();
      let body: DashboardScheduledChangeConflict | null = null;
      try {
        body = text
          ? (JSON.parse(text) as DashboardScheduledChangeConflict)
          : null;
      } catch {
        body = null;
      }
      if (body?.code === "scheduled_change_exists") {
        throw new PmtHouseError(body.error || "Scheduled plan change exists", {
          status: 409,
          code: "scheduled_change_exists",
          details: body,
        });
      }
    }
    return await readPymthouseResponse<DashboardSubscriptionChange>(response);
  } catch (error) {
    if (isOwnerWalletMutationError(error)) {
      return changeOwnerWalletPlan({ planId: input.planId });
    }
    throw error;
  }
}

type UserSubscriptionWithLivePlan = UserSubscriptionResponse & {
  livePlan?: { id?: string | null; name?: string | null } | null;
};

export function mapDashboardUserSubscription(
  result: UserSubscriptionWithLivePlan
): DashboardUserSubscription {
  const sub = result.subscription;
  const pending = result.pendingCancel ?? null;
  const livePlanId = result.livePlan?.id?.trim() || null;
  const livePlanName = result.livePlan?.name?.trim() || null;
  return {
    planId:
      sub?.planId?.trim() || livePlanId || pending?.planId?.trim() || null,
    planName:
      sub?.planName?.trim() ||
      livePlanName ||
      pending?.planName?.trim() ||
      null,
    status: sub?.status?.trim() || (pending ? "canceled" : null),
    subscriptionId: sub?.id?.trim() || pending?.subscriptionId?.trim() || null,
    currentPeriodEnd:
      sub?.currentPeriodEnd?.trim() || pending?.effectiveAt?.trim() || null,
    timingOptions: result.timingOptions ?? null,
    pendingCancel: pending
      ? {
          subscriptionId: pending.subscriptionId,
          planId: pending.planId,
          planKey: pending.planKey,
          planName: pending.planName,
          effectiveAt: pending.effectiveAt,
        }
      : null,
  };
}

export async function getDashboardUserSubscription(
  externalUserId: string
): Promise<DashboardUserSubscription> {
  if ((await resolveSessionBillingRail(externalUserId)) === "owner") {
    return mapOwnerUserSubscription(await getOwnerSubscriptionStatus());
  }
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const result = (await client.getUserSubscription(
    externalUserId
  )) as UserSubscriptionWithLivePlan;
  return mapDashboardUserSubscription(result);
}

export async function cancelDashboardUserSubscription(
  externalUserId: string,
  opts?: { timing?: string; effectiveAt?: string }
): Promise<void> {
  if ((await resolveSessionBillingRail(externalUserId)) === "owner") {
    await cancelOwnerWalletPlan();
    return;
  }
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  await client.cancelUserSubscription(externalUserId, {
    confirm: true,
    ...(opts?.timing ? { timing: opts.timing } : {}),
    ...(opts?.effectiveAt ? { effectiveAt: opts.effectiveAt } : {}),
  });
}

export async function resumeDashboardUserSubscription(
  externalUserId: string
): Promise<void> {
  if ((await resolveSessionBillingRail(externalUserId)) === "owner") {
    await resumeOwnerWalletPlan();
    return;
  }
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  await client.resumeUserSubscription(externalUserId, { confirm: true });
}

export async function listDashboardUserSubscriptions(externalUserId: string) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.listUserSubscriptions(externalUserId);
}

export async function listDashboardUserInvoices(
  externalUserId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<{
  items: DashboardInvoice[];
  page: number;
  pageSize: number;
  totalCount: number;
}> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.listUserInvoices(externalUserId, opts);
}

export async function getDashboardUserInvoiceHostedUrl(
  externalUserId: string,
  invoiceId: string
): Promise<DashboardInvoiceHostedUrl> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.getUserInvoiceHostedUrl(externalUserId, invoiceId);
}

export async function listDashboardUserPaymentMethods(
  externalUserId: string
): Promise<DashboardPaymentMethod[]> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const result = await client.listUserPaymentMethods(externalUserId);
  return result.paymentMethods ?? [];
}

export async function startDashboardPaymentMethodCheckout(input: {
  externalUserId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CreateAppUserPaymentMethodCheckoutResult> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.createUserPaymentMethodCheckout({
    externalUserId: input.externalUserId,
    ...(input.successUrl ? { successUrl: input.successUrl } : {}),
    ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
  });
}

export async function setDashboardUserDefaultPaymentMethod(
  externalUserId: string,
  paymentMethodId: string
) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.setUserDefaultPaymentMethod(externalUserId, paymentMethodId);
}

/** Promote first attached PM to Stripe default when none is set (post-Checkout). */
export async function ensureDashboardUserDefaultPaymentMethod(
  externalUserId: string
) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.ensureUserDefaultPaymentMethod(externalUserId);
}

export async function removeDashboardUserPaymentMethod(
  externalUserId: string,
  paymentMethodId: string
) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.unlinkUserPaymentMethod(externalUserId, paymentMethodId);
}

// ---------------------------------------------------------------------------
// Owner wallet (Builder M2M) — pymthouse PR #399
// /api/v1/apps/{clientId}/billing/wallet* over M2M Basic auth.
// ---------------------------------------------------------------------------

async function walletFetch<T>(
  path: string,
  init?: {
    method?: string;
    body?: Record<string, unknown>;
    externalUserId?: string;
    query?: Record<string, string | number | undefined>;
  }
): Promise<T> {
  const publicClientId = readPublicClientId();
  const params = new URLSearchParams();
  const externalUserId = init?.externalUserId?.trim();
  if (externalUserId && (init?.method ?? "GET") === "GET") {
    params.set("externalUserId", externalUserId);
  }
  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  const separator = path.includes("?") ? "&" : "?";
  const urlPath = `${path}${query ? `${separator}${query}` : ""}`;

  const method = init?.method ?? "GET";
  const body =
    init?.body || (externalUserId && (method === "POST" || method === "PATCH"))
      ? {
          ...(init?.body ?? {}),
          ...(externalUserId && (method === "POST" || method === "PATCH")
            ? { externalUserId }
            : {}),
        }
      : undefined;

  const response = await fetch(
    `${pymthouseAppsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/billing/wallet${urlPath}`,
    {
      method,
      headers: {
        Authorization: readM2mAuthHeader(),
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    }
  );
  return readPymthouseResponse<T>(response);
}

export async function getDashboardOwnerWallet(
  externalUserId: string
): Promise<DashboardOwnerWallet> {
  return walletFetch<DashboardOwnerWallet>("", {
    externalUserId,
  });
}

export async function startDashboardWalletTopUp(input: {
  amountUsd: string;
  externalUserId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<DashboardWalletTopUpResult> {
  return walletFetch<DashboardWalletTopUpResult>("/top-up", {
    method: "POST",
    externalUserId: input.externalUserId,
    body: {
      amountUsd: input.amountUsd,
      ...(input.successUrl ? { successUrl: input.successUrl } : {}),
      ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
    },
  });
}

export async function listDashboardWalletInvoices(opts: {
  externalUserId: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: DashboardWalletInvoice[];
  page: number;
  pageSize: number;
  totalCount: number;
}> {
  return walletFetch(`/invoices`, {
    externalUserId: opts.externalUserId,
    query: {
      page: opts.page,
      pageSize: opts.pageSize,
    },
  });
}

export async function listDashboardWalletPaymentMethods(
  externalUserId: string
): Promise<DashboardWalletPaymentMethod[]> {
  const result = await walletFetch<{
    paymentMethods?: DashboardWalletPaymentMethod[];
  }>("/payment-methods", { externalUserId });
  return result.paymentMethods ?? [];
}

export async function startDashboardWalletPaymentMethodCheckout(input: {
  externalUserId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<DashboardWalletPaymentMethodCheckoutResult> {
  return walletFetch<DashboardWalletPaymentMethodCheckoutResult>(
    "/payment-methods",
    {
      method: "POST",
      externalUserId: input.externalUserId,
      body: {
        ...(input.successUrl ? { successUrl: input.successUrl } : {}),
        ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
      },
    }
  );
}

export async function ensureDashboardWalletDefaultPaymentMethod(
  externalUserId: string
): Promise<{ promoted: boolean; paymentMethodId: string | null }> {
  return walletFetch<{ promoted: boolean; paymentMethodId: string | null }>(
    "/payment-methods",
    {
      method: "PATCH",
      externalUserId,
      body: { ensureDefault: true },
    }
  );
}
