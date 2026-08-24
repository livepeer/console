"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardInvoice,
  DashboardInvoiceHostedUrl,
  DashboardPaymentMethod,
  DashboardSubscriptionHistoryItem,
} from "@/lib/console/pymthouse-billing";
import { readResponseJson } from "@/lib/console/read-response-json";

/** Map missing/unroutable upstream billing APIs to an actionable message. */
function billingUpstreamMessage(
  surface: "payment methods" | "invoices" | "subscriptions",
  status: number,
  upstreamError?: string
): string {
  if (status === 404 || status === 405) {
    if (surface === "subscriptions") {
      return (
        `PymtHouse end-user subscriptions API is unavailable (${status}). ` +
        "Deploy the /users/{id}/subscriptions route to this environment."
      );
    }
    return (
      `PymtHouse end-user ${surface} API is unavailable (${status}). ` +
      "Deploy the /users/{id}/payment-methods and /users/{id}/invoices routes " +
      "(pymthouse PR #386) to this environment."
    );
  }
  return upstreamError ?? `${surface} failed (${status})`;
}

/**
 * List endpoints may answer 503 "Billing unavailable" for expected empty
 * conditions (no Stripe customer yet, sandbox Connect not ready, OM admin
 * client offline). Those are empty states, not hard UI failures.
 */
export function isSoftBillingListUnavailable(
  status: number,
  upstreamError?: string
): boolean {
  if (status !== 503) return false;
  const msg = upstreamError?.trim().toLowerCase() ?? "";
  return !msg || msg === "billing unavailable";
}

type BillingAccountState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      paymentMethods: DashboardPaymentMethod[];
      invoices: DashboardInvoice[];
      subscriptions: DashboardSubscriptionHistoryItem[];
      paymentMethodsError: string | null;
      invoicesError: string | null;
      subscriptionsError: string | null;
    };

type ListLoadResult<T> = {
  items: T[];
  error: string | null;
};

async function loadPaymentMethods(): Promise<
  ListLoadResult<DashboardPaymentMethod>
> {
  try {
    const response = await fetch("/api/pymthouse/payment-methods");
    const body = await readResponseJson<{
      paymentMethods?: DashboardPaymentMethod[];
      error?: string;
    }>(response);
    if (!response.ok) {
      if (isSoftBillingListUnavailable(response.status, body.error)) {
        return { items: [], error: null };
      }
      return {
        items: [],
        error: billingUpstreamMessage(
          "payment methods",
          response.status,
          body.error
        ),
      };
    }
    return { items: body.paymentMethods ?? [], error: null };
  } catch (error) {
    return {
      items: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to load payment methods",
    };
  }
}

async function loadInvoices(): Promise<ListLoadResult<DashboardInvoice>> {
  try {
    const response = await fetch("/api/pymthouse/invoices?pageSize=20");
    const body = await readResponseJson<{
      items?: DashboardInvoice[];
      error?: string;
    }>(response);
    if (!response.ok) {
      if (isSoftBillingListUnavailable(response.status, body.error)) {
        return { items: [], error: null };
      }
      return {
        items: [],
        error: billingUpstreamMessage("invoices", response.status, body.error),
      };
    }
    return { items: body.items ?? [], error: null };
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : "Failed to load invoices",
    };
  }
}

async function loadSubscriptions(): Promise<
  ListLoadResult<DashboardSubscriptionHistoryItem>
> {
  try {
    const response = await fetch("/api/pymthouse/subscriptions");
    const body = await readResponseJson<{
      items?: DashboardSubscriptionHistoryItem[];
      error?: string;
    }>(response);
    if (!response.ok) {
      if (isSoftBillingListUnavailable(response.status, body.error)) {
        return { items: [], error: null };
      }
      return {
        items: [],
        error: billingUpstreamMessage(
          "subscriptions",
          response.status,
          body.error
        ),
      };
    }
    return { items: body.items ?? [], error: null };
  } catch (error) {
    return {
      items: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to load subscription history",
    };
  }
}

export function useBillingAccount(enabled: boolean) {
  const [state, setState] = useState<BillingAccountState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({
        status: "ready",
        paymentMethods: [],
        invoices: [],
        subscriptions: [],
        paymentMethodsError: null,
        invoicesError: null,
        subscriptionsError: null,
      });
      return;
    }

    setState({ status: "loading" });
    const [pm, inv, subs] = await Promise.all([
      loadPaymentMethods(),
      loadInvoices(),
      loadSubscriptions(),
    ]);
    setState({
      status: "ready",
      paymentMethods: pm.items,
      invoices: inv.items,
      subscriptions: subs.items,
      paymentMethodsError: pm.error,
      invoicesError: inv.error,
      subscriptionsError: subs.error,
    });
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const startPaymentMethodCheckout = useCallback(
    async (input?: { successUrl?: string; cancelUrl?: string }) => {
      const response = await fetch("/api/pymthouse/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      const body = await readResponseJson<{
        checkoutUrl?: string;
        error?: string;
      }>(response);
      if (!response.ok || !body.checkoutUrl) {
        throw new Error(
          body.error ?? `Payment method checkout failed (${response.status})`
        );
      }
      return { checkoutUrl: body.checkoutUrl };
    },
    []
  );

  const openInvoice = useCallback(
    async (input: { invoiceId: string }): Promise<DashboardInvoiceHostedUrl> => {
      const response = await fetch(
        `/api/pymthouse/invoices/${encodeURIComponent(input.invoiceId)}/hosted-url`
      );
      const body = await readResponseJson<
        DashboardInvoiceHostedUrl & { error?: string }
      >(response);
      if (!response.ok) {
        throw new Error(body.error ?? `Invoice link failed (${response.status})`);
      }
      return {
        hostedInvoiceUrl: body.hostedInvoiceUrl ?? null,
        invoicePdf: body.invoicePdf ?? null,
      };
    },
    []
  );

  const setDefaultPaymentMethod = useCallback(
    async (input: { paymentMethodId: string }) => {
      const response = await fetch("/api/pymthouse/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: input.paymentMethodId }),
      });
      const body = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          body.error ?? `Set default payment method failed (${response.status})`
        );
      }
      await load();
    },
    [load]
  );

  const ensureDefaultPaymentMethod = useCallback(async () => {
    const response = await fetch("/api/pymthouse/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ensureDefault: true }),
    });
    const body = await readResponseJson<{ error?: string }>(response);
    if (!response.ok) {
      throw new Error(
        body.error ??
          `Ensure default payment method failed (${response.status})`
      );
    }
    await load();
  }, [load]);

  const removePaymentMethod = useCallback(
    async (input: { paymentMethodId: string }) => {
      const response = await fetch("/api/pymthouse/payment-methods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: input.paymentMethodId }),
      });
      const body = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          body.error ?? `Remove payment method failed (${response.status})`
        );
      }
      await load();
    },
    [load]
  );

  return {
    state,
    reload: load,
    startPaymentMethodCheckout,
    openInvoice,
    setDefaultPaymentMethod,
    ensureDefaultPaymentMethod,
    removePaymentMethod,
  };
}
