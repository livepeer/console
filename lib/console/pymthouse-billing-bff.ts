import "server-only";

import {
  PmtHouseError,
  type BillingProduct,
  type CreateBillingCheckoutResult,
  type UserSubscriptionResponse,
} from "@pymthouse/builder-sdk";
import { createPmtHouseClientForPublicApp } from "@/lib/console/pymthouse-bff";
import type {
  DashboardBillingPlan,
  DashboardScheduledChangeConflict,
  DashboardSubscriptionChange,
  DashboardUserSubscription,
} from "@/lib/console/pymthouse-billing";
import {
  pymthouseAppsOrigin,
  readM2mAuthHeader,
  readPublicClientId,
  readPymthouseResponse,
} from "@/lib/console/pymthouse-http";

export type {
  DashboardBillingPlan,
  DashboardScheduledChangeConflict,
  DashboardSubscriptionChange,
  DashboardUserSubscription,
} from "@/lib/console/pymthouse-billing";

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

export async function listDashboardBillingPlans(): Promise<
  DashboardBillingPlan[]
> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const { products } = await client.listBillingProducts();
  return (products ?? [])
    .filter((p) => p.status === "active" && !p.isNetworkDefault)
    .map(mapProduct)
    .sort((a, b) => Number(b.isStarterDefault) - Number(a.isStarterDefault));
}

export async function startDashboardBillingCheckout(input: {
  planId: string;
  externalUserId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CreateBillingCheckoutResult> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.createBillingCheckout({
    planId: input.planId,
    externalUserId: input.externalUserId,
    ...(input.successUrl ? { successUrl: input.successUrl } : {}),
    ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
  });
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
  const publicClientId = readPublicClientId();
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
  return readPymthouseResponse<DashboardSubscriptionChange>(response);
}

export async function getDashboardUserSubscription(
  externalUserId: string
): Promise<DashboardUserSubscription> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const result: UserSubscriptionResponse =
    await client.getUserSubscription(externalUserId);
  const sub = result.subscription;
  const pending = result.pendingCancel ?? null;
  return {
    planId: sub?.planId?.trim() || pending?.planId?.trim() || null,
    planName: sub?.planName?.trim() || pending?.planName?.trim() || null,
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

export async function cancelDashboardUserSubscription(
  externalUserId: string,
  opts?: { timing?: string; effectiveAt?: string }
): Promise<void> {
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
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  await client.resumeUserSubscription(externalUserId, { confirm: true });
}

export async function listDashboardUserSubscriptions(externalUserId: string) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.listUserSubscriptions(externalUserId);
}
