import {
  PmtHouseError,
  type BillingProduct,
  type CreateBillingCheckoutResult,
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
