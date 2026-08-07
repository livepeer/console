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
      { status: 503, code: "pymthouse_required" },
    );
  }
  return id;
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
export async function listDashboardBillingPlans(): Promise<DashboardBillingPlan[]> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const { products } = await client.listBillingProducts();
  return (products ?? [])
    .filter(
      (p) =>
        p.status === "active" &&
        !p.isNetworkDefault &&
        !p.isStarterDefault,
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

export type DashboardUserSubscription = {
  planId: string | null;
  planName: string | null;
  status: string | null;
  subscriptionId: string | null;
};

export async function getDashboardUserSubscription(
  externalUserId: string,
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
  opts?: { page?: number; pageSize?: number },
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
  invoiceId: string,
): Promise<AppUserInvoiceHostedUrlResult> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.getUserInvoiceHostedUrl(externalUserId, invoiceId);
}

export async function listDashboardUserPaymentMethods(
  externalUserId: string,
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
  paymentMethodId: string,
) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.setUserDefaultPaymentMethod(externalUserId, paymentMethodId);
}

export async function removeDashboardUserPaymentMethod(
  externalUserId: string,
  paymentMethodId: string,
) {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  return client.unlinkUserPaymentMethod(externalUserId, paymentMethodId);
}
