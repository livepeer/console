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
