import "server-only";

import {
  isMerchantBillingRequiredError,
  readAccessTokenBillingMode,
  type AppUserInvoice,
  type BillingState,
  type EndUserMeWallet,
  type UserSubscriptionResponse,
} from "@pymthouse/builder-sdk";

import { mapDashboardUserSubscription } from "@/lib/console/pymthouse-billing-bff";
import type { DashboardUserSubscription } from "@/lib/console/pymthouse-billing";
import {
  createPmtHouseClientForPublicApp,
  mintEndUserAccessToken,
} from "@/lib/console/pymthouse-bff";
import { readPublicClientId } from "@/lib/console/pymthouse-http";
import { resolveSessionBillingRail } from "@/lib/console/pymthouse-owner-billing-bff";
import type {
  DashboardOwnerWallet,
  DashboardWalletInvoice,
  DashboardWalletPaymentMethod,
} from "@/lib/console/pymthouse-wallet";

export type MerchantMeBillingBundle = {
  mode: "merchant";
  state: BillingState | null;
  wallet: DashboardOwnerWallet | null;
  subscription: DashboardUserSubscription | null;
  paymentMethods: DashboardWalletPaymentMethod[];
  invoices: DashboardWalletInvoice[];
};

export type MeBillingSurface =
  | {
      mode: "owner_rollup";
      code: "merchant_billing_required";
    }
  | MerchantMeBillingBundle;

type UserSubscriptionWithLivePlan = UserSubscriptionResponse & {
  livePlan?: { id?: string | null; name?: string | null } | null;
};

function asOwnerWallet(wallet: EndUserMeWallet): DashboardOwnerWallet {
  return {
    clientId: wallet.clientId,
    balance: wallet.balance,
    paymentMethod: wallet.paymentMethod,
    billingState: wallet.billingState,
    payPerUsePlans: wallet.payPerUsePlans,
  };
}

function mapInvoice(invoice: AppUserInvoice): DashboardWalletInvoice {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    totalAmount: invoice.totalAmount,
    issuedAt: invoice.issuedAt,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    invoiceType: invoice.invoiceType,
  };
}

async function readMerchantPiece<T>(
  load: () => Promise<T>
): Promise<T | "rollup" | null> {
  try {
    return await load();
  } catch (error) {
    if (isMerchantBillingRequiredError(error)) {
      return "rollup";
    }
    return null;
  }
}

export async function readSessionMeBilling(input: {
  externalUserId: string;
  email?: string;
}): Promise<MeBillingSurface> {
  const rail = await resolveSessionBillingRail(
    input.externalUserId,
    input.email
  );
  if (rail === "owner") {
    return { mode: "owner_rollup", code: "merchant_billing_required" };
  }

  const accessToken = await mintEndUserAccessToken(
    input.externalUserId,
    input.email
  );
  const mintedMode = readAccessTokenBillingMode(accessToken);
  if (mintedMode === "owner_rollup") {
    return { mode: "owner_rollup", code: "merchant_billing_required" };
  }

  const client = createPmtHouseClientForPublicApp(readPublicClientId());

  const [
    stateResult,
    walletResult,
    subscriptionResult,
    pmResult,
    invoiceResult,
  ] = await Promise.all([
    readMerchantPiece(() => client.getMeBillingState(accessToken)),
    readMerchantPiece(() => client.getMeBillingWallet(accessToken)),
    readMerchantPiece(() => client.getMeBillingSubscription(accessToken)),
    readMerchantPiece(() => client.getMeBillingPaymentMethods(accessToken)),
    readMerchantPiece(() =>
      client.getMeBillingInvoices(accessToken, { pageSize: 20 })
    ),
  ]);

  if (
    stateResult === "rollup" ||
    walletResult === "rollup" ||
    subscriptionResult === "rollup" ||
    pmResult === "rollup" ||
    invoiceResult === "rollup"
  ) {
    return { mode: "owner_rollup", code: "merchant_billing_required" };
  }

  return {
    mode: "merchant",
    state: stateResult,
    wallet: walletResult ? asOwnerWallet(walletResult) : null,
    subscription: subscriptionResult
      ? mapDashboardUserSubscription(
          subscriptionResult as UserSubscriptionWithLivePlan
        )
      : null,
    paymentMethods: pmResult?.paymentMethods ?? [],
    invoices: (invoiceResult?.items ?? []).map(mapInvoice),
  };
}
