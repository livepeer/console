export type DashboardBillingPlan = {
  id: string;
  name: string;
  type: string;
  status: string;
  priceAmount: string;
  priceCurrency: string;
  billingCycle: string | null;
  includedUsdMicros: string | null;
  chargeThresholdUsdMicros: string | null;
  resolvedBehavior: string | null;
  capabilityCount: number;
  isStarterDefault: boolean;
};

export type DashboardSubscriptionChange = {
  subscriptionId: string;
  planId: string;
  effectiveAt: string | null;
  timing: "immediate" | "next_billing_cycle" | string;
  checkoutUrl?: string;
};

export type DashboardScheduledChangeConflict = {
  code: "scheduled_change_exists";
  error: string;
  timingOptions: {
    minEffectiveAt: string;
    maxEffectiveAt: string | null;
    presets: Array<"immediate" | "next_billing_cycle">;
  } | null;
  scheduledSubscriptionId: string | null;
  scheduledPlanKey: string | null;
  scheduledActiveFrom: string | null;
};

export type DashboardInvoice = {
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

export type DashboardPaymentMethod = {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

export type DashboardSubscriptionHistoryItem = {
  id: string;
  status: string;
  current: boolean;
  planId: string | null;
  planKey: string | null;
  planName: string | null;
  activeFrom: string | null;
  activeTo: string | null;
};

export type DashboardInvoiceHostedUrl = {
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export type DashboardUserSubscription = {
  planId: string | null;
  planName: string | null;
  status: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  timingOptions: {
    cancel: {
      minEffectiveAt: string;
      maxEffectiveAt: string | null;
      presets: Array<"immediate" | "next_billing_cycle">;
    };
    change: {
      minEffectiveAt: string;
      maxEffectiveAt: string | null;
      presets: Array<"immediate" | "next_billing_cycle">;
    };
  } | null;
  pendingCancel: {
    subscriptionId: string;
    planId: string | null;
    planKey: string | null;
    planName: string | null;
    effectiveAt: string | null;
  } | null;
};
