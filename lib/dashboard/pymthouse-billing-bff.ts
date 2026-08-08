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
  chargeThresholdUsdMicros: string | null;
  resolvedBehavior: string | null;
  capabilityCount: number;
};

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapProduct(product: BillingProduct): DashboardBillingPlan {
  // PymtHouse sends these fields for usage plans; keep the mapping resilient
  // until the SDK's BillingProduct type guarantees them.
  const dynamicProduct = product as BillingProduct & {
    chargeThresholdUsdMicros?: unknown;
    resolvedBehavior?: unknown;
  };

  return {
    id: product.id,
    name: product.name,
    type: product.type,
    status: product.status,
    priceAmount: product.priceAmount,
    priceCurrency: product.priceCurrency,
    billingCycle: product.allowance?.billingCycle ?? null,
    chargeThresholdUsdMicros: readOptionalString(
      dynamicProduct.chargeThresholdUsdMicros
    ),
    resolvedBehavior: readOptionalString(dynamicProduct.resolvedBehavior),
    capabilityCount: product.capabilities?.length ?? 0,
  };
}

/** Active (non-starter / non-network-default) products available for subscribe. */
export async function listDashboardBillingPlans(): Promise<
  DashboardBillingPlan[]
> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const { products } = await client.listBillingProducts();
  const plans = (products ?? [])
    .filter(
      (p) => p.status === "active" && !p.isNetworkDefault && !p.isStarterDefault
    )
    .map(mapProduct);

  // The apiVersion=2 billing-product shape omits chargeThresholdUsdMicros /
  // resolvedBehavior (pymthouse toBillingProduct). The owner wallet summary
  // (pymthouse PR #399) carries them per active usage plan — hydrate from it.
  const needsHydration = plans.some(
    (p) =>
      p.type.trim().toLowerCase() === "usage" &&
      (!p.chargeThresholdUsdMicros || !p.resolvedBehavior)
  );
  if (needsHydration) {
    try {
      const wallet = await getDashboardOwnerWallet();
      const byPlanId = new Map(
        wallet.payPerUsePlans.map((p) => [p.planId, p])
      );
      for (const plan of plans) {
        const walletPlan = byPlanId.get(plan.id);
        if (!walletPlan) continue;
        plan.chargeThresholdUsdMicros ??= walletPlan.chargeThresholdUsdMicros;
        plan.resolvedBehavior ??= walletPlan.resolvedBehavior;
      }
    } catch {
      // Wallet API unavailable (older pymthouse deploy) — keep fields null and
      // let the UI fall back to its generic pay-per-use copy.
    }
  }
  return plans;
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

export async function getDashboardUserSubscription(
  externalUserId: string
): Promise<DashboardUserSubscription> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  const result: UserSubscriptionResponse =
    await client.getUserSubscription(externalUserId);
  const sub = result.subscription;
  const pending = result.pendingCancel ?? null;
  // Prefer OpenMeter/builder fields; pendingCancel carries cancel-at-period-end
  // plan identity when the live row is already canceled/inactive.
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

// ---------------------------------------------------------------------------
// Owner wallet (Builder M2M) — pymthouse PR #399
// /api/v1/apps/{clientId}/billing/wallet* over M2M Basic auth. This is the
// app owner's prepaid wallet (OpenAI-style usage page): balance, top-up via
// Stripe Checkout, past platform invoices, and the auto-debit payment method.
// ---------------------------------------------------------------------------

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
  payPerUsePlans: DashboardWalletPayPerUsePlan[];
  settlement: {
    order: string; // "credits_then_auto_debit"
    description: string;
  };
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

async function walletFetch<T>(
  path: string,
  init?: { method?: string; body?: Record<string, unknown> }
): Promise<T> {
  const publicClientId = readPublicClientId();
  const response = await fetch(
    `${pymthouseAppsOrigin()}/api/v1/apps/${encodeURIComponent(publicClientId)}/billing/wallet${path}`,
    {
      method: init?.method ?? "GET",
      headers: {
        Authorization: readM2mAuthHeader(),
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
    }
  );
  return readPymthouseResponse<T>(response);
}

/** GET …/billing/wallet — balance, PM on file, resolved PPU behavior, settlement order. */
export async function getDashboardOwnerWallet(): Promise<DashboardOwnerWallet> {
  return walletFetch<DashboardOwnerWallet>("");
}

/** POST …/billing/wallet/top-up — payment-mode Stripe Checkout ($1–$10,000). */
export async function startDashboardWalletTopUp(input: {
  amountUsd: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<DashboardWalletTopUpResult> {
  return walletFetch<DashboardWalletTopUpResult>("/top-up", {
    method: "POST",
    body: {
      amountUsd: input.amountUsd,
      ...(input.successUrl ? { successUrl: input.successUrl } : {}),
      ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
    },
  });
}

/** GET …/billing/wallet/invoices — past platform invoices, newest first. */
export async function listDashboardWalletInvoices(opts?: {
  page?: number;
  pageSize?: number;
}): Promise<{
  items: DashboardWalletInvoice[];
  page: number;
  pageSize: number;
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  const query = params.toString();
  return walletFetch(`/invoices${query ? `?${query}` : ""}`);
}

/** GET …/billing/wallet/payment-methods — attached PMs (brand + last4 only). */
export async function listDashboardWalletPaymentMethods(): Promise<
  DashboardWalletPaymentMethod[]
> {
  const result = await walletFetch<{
    paymentMethods?: DashboardWalletPaymentMethod[];
  }>("/payment-methods");
  return result.paymentMethods ?? [];
}

/** POST …/billing/wallet/payment-methods — setup-mode Stripe Checkout for the auto-debit PM. */
export async function startDashboardWalletPaymentMethodCheckout(input: {
  successUrl?: string;
  cancelUrl?: string;
}): Promise<DashboardWalletPaymentMethodCheckoutResult> {
  return walletFetch<DashboardWalletPaymentMethodCheckoutResult>(
    "/payment-methods",
    {
      method: "POST",
      body: {
        ...(input.successUrl ? { successUrl: input.successUrl } : {}),
        ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
      },
    }
  );
}
