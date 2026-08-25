import "server-only";

import { mintEndUserAccessToken } from "@/lib/console/pymthouse-bff";
import {
  pymthouseAppsOrigin,
  readPublicClientId,
} from "@/lib/console/pymthouse-http";

export type MeBillingSurface =
  | {
      mode: "owner_rollup";
      code: "merchant_billing_required";
    }
  | {
      mode: "merchant";
      allowances: Record<string, unknown> | null;
      state: Record<string, unknown> | null;
      subscription: Record<string, unknown> | null;
      wallet: Record<string, unknown> | null;
      invoices: Record<string, unknown> | null;
      paymentMethods: Record<string, unknown> | null;
    };

async function getMeBilling(
  accessToken: string,
  suffix: string
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const url = `${pymthouseAppsOrigin()}/api/v1/apps/${encodeURIComponent(readPublicClientId())}/me/billing/${suffix}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return { status: response.status, body };
}

export async function readSessionMeBilling(input: {
  externalUserId: string;
  email?: string;
}): Promise<MeBillingSurface> {
  const accessToken = await mintEndUserAccessToken(
    input.externalUserId,
    input.email
  );
  const allowances = await getMeBilling(accessToken, "allowances");
  if (
    allowances.status === 403 &&
    (allowances.body?.code === "merchant_billing_required" ||
      allowances.body?.code === "merchant_wallet_required")
  ) {
    return { mode: "owner_rollup", code: "merchant_billing_required" };
  }

  const [billingState, subscription, wallet, invoices, paymentMethods] =
    await Promise.all([
      getMeBilling(accessToken, "state"),
      getMeBilling(accessToken, "subscription"),
      getMeBilling(accessToken, "wallet"),
      getMeBilling(accessToken, "invoices"),
      getMeBilling(accessToken, "payment-methods"),
    ]);

  return {
    mode: "merchant",
    allowances: allowances.status === 200 ? allowances.body : null,
    state: billingState.status === 200 ? billingState.body : null,
    subscription: subscription.status === 200 ? subscription.body : null,
    wallet: wallet.status === 200 ? wallet.body : null,
    invoices: invoices.status === 200 ? invoices.body : null,
    paymentMethods: paymentMethods.status === 200 ? paymentMethods.body : null,
  };
}
