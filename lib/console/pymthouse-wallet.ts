import type { BillingState } from "@pymthouse/builder-sdk";

export type DashboardWalletBalance = {
  usdMicros: string;
  usd: string;
  lifetimeGrantedUsdMicros: string;
  consumedUsdMicros: string;
};

export type DashboardWalletPayPerUsePlan = {
  planId: string;
  planName: string;
  chargeThresholdUsdMicros: string | null;
  resolvedBehavior: string;
};

export type DashboardOwnerWallet = {
  clientId: string;
  balance: DashboardWalletBalance | null;
  paymentMethod: {
    /** null = provider state unknown (fail open upstream). */
    hasDefault: boolean | null;
  };
  billingState: BillingState;
  payPerUsePlans: DashboardWalletPayPerUsePlan[];
};

export type DashboardWalletInvoice = {
  id: string;
  number?: string;
  status: string;
  currency: string;
  totalAmount: string;
  issuedAt?: string;
  periodStart?: string;
  periodEnd?: string;
  invoiceType?: string;
};

export type DashboardWalletPaymentMethod = {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

export type DashboardWalletTopUpResult = {
  checkoutUrl: string;
  sessionId: string | null;
  amountUsdMicros: string;
};

export type DashboardWalletPaymentMethodCheckoutResult = {
  checkoutUrl: string;
  sessionId: string | null;
  hasDefaultPaymentMethod: boolean;
};
