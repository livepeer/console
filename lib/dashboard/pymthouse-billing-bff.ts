import {
  PmtHouseError,
  type AppUserInvoice,
  type AppUserInvoiceHostedUrlResult,
  type AppUserPaymentMethod,
  type BillingProduct,
  type CreateAppUserPaymentMethodCheckoutResult,
  type CreateBillingCheckoutResult,
  type UserSubscriptionResponse,
} from "@pymthouse/builder-sdk";
import { createPmtHouseClientForPublicApp } from "@/lib/dashboard/pymthouse-bff";

function readPublicClientId(): string {
  const id =
    process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ||
    process.env.DASHBOARD_DEVICE_PUBLIC_CLIENT_ID?.trim();
  if (!id) {
    throw new PmtHouseError(
      "PYMTHOUSE_PUBLIC_CLIENT_ID (or DASHBOARD_DEVICE_PUBLIC_CLIENT_ID) is required",
      { status: 503, code: "pymthouse_required" }
    );
  }
  return id;
}

function readM2mAuthHeader(): string {
  const clientId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const clientSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new PmtHouseError(
      "PYMTHOUSE_M2M_CLIENT_ID and PYMTHOUSE_M2M_CLIENT_SECRET are required",
      { status: 503, code: "pymthouse_required" }
    );
  }
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function pymthouseAppsOrigin(): string {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  if (!issuerUrl) {
    throw new PmtHouseError("PYMTHOUSE_ISSUER_URL is required", {
      status: 503,
      code: "pymthouse_required",
    });
  }
  return issuerUrl.replace(/\/api\/v1\/oidc\/?$/i, "");
}

async function readPymthouseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: (T & { error?: string }) | null = null;
  try {
    body = text ? (JSON.parse(text) as T & { error?: string }) : null;
  } catch {
    throw new PmtHouseError(
      `PymtHouse returned non-JSON (${response.status})`,
      {
        status: 502,
        code: "invalid_json",
      }
    );
  }
  if (!response.ok) {
    throw new PmtHouseError(
      body?.error ?? `Request failed (${response.status})`,
      {
        status: response.status,
        code: "subscription_change_failed",
        details: body ?? undefined,
      }
    );
  }
  if (!body) {
    throw new PmtHouseError("PymtHouse returned an empty response", {
      status: 502,
      code: "invalid_response",
    });
  }
  return body;
}

export type DashboardBillingPlan = {
  id: string;
  name: string;
  type: string;
  status: string;
  priceAmount: string;
  priceCurrency: string;
  billingCycle: string | null;
  capabilityCount: number;
};

function mapProduct(product: BillingProduct): DashboardBillingPlan {
  return {
    id: product.id,
    name: product.name,
    type: product.type,
    status: product.status,
    priceAmount: product.priceAmount,
    priceCurrency: product.priceCurrency,
    billingCycle: product.allowance?.billingCycle ?? null,
    capabilityCount: product.capabilities?.length ?? 0,
  };
}

/** Active (non-starter / non-network-default) products available for subscribe. */
export async function listDashboardBillingPlans(): Promise<
  DashboardBillingPlan[]
> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const { products } = await client.listBillingProducts();
  return (products ?? [])
    .filter(
      (p) => p.status === "active" && !p.isNetworkDefault && !p.isStarterDefault
    )
    .map(mapProduct);
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

export type DashboardSubscriptionChange = {
  subscriptionId: string;
  planId: string;
  effectiveAt: string | null;
  timing: "immediate" | "next_billing_cycle";
  checkoutUrl?: string;
};

export async function changeDashboardBillingSubscription(input: {
  planId: string;
  externalUserId: string;
  successUrl?: string;
  cancelUrl?: string;
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
      }),
      cache: "no-store",
    }
  );
  return readPymthouseResponse<DashboardSubscriptionChange>(response);
}

export type DashboardUserSubscription = {
  planId: string | null;
  planName: string | null;
  status: string | null;
  subscriptionId: string | null;
};

export async function getDashboardUserSubscription(
  externalUserId: string
): Promise<DashboardUserSubscription> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const result: UserSubscriptionResponse =
    await client.getUserSubscription(externalUserId);
  const sub = result.subscription;
  return {
    planId: sub?.planId?.trim() || null,
    planName: sub?.planName?.trim() || null,
    status: sub?.status?.trim() || null,
    subscriptionId: sub?.id?.trim() || null,
  };
}

export type DashboardInvoice = AppUserInvoice;
export type DashboardPaymentMethod = AppUserPaymentMethod;

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
): Promise<AppUserInvoiceHostedUrlResult> {
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

export async function removeDashboardUserPaymentMethod(
  externalUserId: string,
  paymentMethodId: string
) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.unlinkUserPaymentMethod(externalUserId, paymentMethodId);
}
