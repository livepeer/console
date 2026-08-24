"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardInvoice,
  DashboardPaymentMethod,
  DashboardSubscriptionHistoryItem,
} from "@/lib/console/pymthouse-billing-bff";

async function readResponseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Empty response (${response.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON (${response.status})`);
  }
}

/** Map missing/unroutable upstream billing APIs to an actionable message. */
function billingUpstreamMessage(
  surface: "payment methods" | "invoices" | "subscriptions",
  status: number,
  upstreamError?: string,
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
  upstreamError?: string,
): boolean {
  if (status !== 503) return false;
  const msg = upstreamError?.trim().toLowerCase() ?? "";
  return !msg || msg === "billing unavailable";
}

export type BillingAccountState =
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

async function loadPaymentMethods(
  externalUserId: string,
): Promise<ListLoadResult<DashboardPaymentMethod>> {
  try {
    const response = await fetch(
      `/api/pymthouse/payment-methods?externalUserId=${encodeURIComponent(externalUserId)}`,
    );
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
          body.error,
        ),
      };
    }
    return { items: body.paymentMethods ?? [], error: null };
  } catch (error) {
    return {
      items: [],
      error:
        error instanceof Error ? error.message : "Failed to load payment methods",
    };
  }
}

async function loadInvoices(
  externalUserId: string,
): Promise<ListLoadResult<DashboardInvoice>> {
  try {
    const response = await fetch(
      `/api/pymthouse/invoices?externalUserId=${encodeURIComponent(externalUserId)}&pageSize=20`,
    );
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

async function loadSubscriptions(
  externalUserId: string,
): Promise<ListLoadResult<DashboardSubscriptionHistoryItem>> {
  try {
    const response = await fetch(
      `/api/pymthouse/subscriptions?externalUserId=${encodeURIComponent(externalUserId)}`,
    );
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
          body.error,
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

export function useBillingAccount(externalUserId: string | undefined) {
  const [state, setState] = useState<BillingAccountState>({ status: "idle" });

  const load = useCallback(async () => {
    const trimmed = externalUserId?.trim();
    if (!trimmed) {
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
    // Independent loads — soft failures must not poison sibling surfaces.
    const [pm, inv, subs] = await Promise.all([
      loadPaymentMethods(trimmed),
      loadInvoices(trimmed),
      loadSubscriptions(trimmed),
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
  }, [externalUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startPaymentMethodCheckout = useCallback(
    async (input: { externalUserId: string }) => {
      const response = await fetch("/api/pymthouse/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalUserId: input.externalUserId }),
      });
      const body = await readResponseJson<{
        checkoutUrl?: string;
        error?: string;
      }>(response);
      if (!response.ok || !body.checkoutUrl) {
        throw new Error(
          body.error ?? `Payment method checkout failed (${response.status})`,
        );
      }
      return { checkoutUrl: body.checkoutUrl };
    },
    [],
  );

  const openInvoice = useCallback(
    async (input: { externalUserId: string; invoiceId: string }) => {
      const response = await fetch(
        `/api/pymthouse/invoices/${encodeURIComponent(input.invoiceId)}/hosted-url?externalUserId=${encodeURIComponent(input.externalUserId)}`,
      );
      const body = await readResponseJson<{
        hostedInvoiceUrl?: string | null;
        invoicePdf?: string | null;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(
          body.error ?? `Invoice link failed (${response.status})`,
        );
      }
      return {
        hostedInvoiceUrl: body.hostedInvoiceUrl ?? null,
        invoicePdf: body.invoicePdf ?? null,
      };
    },
    [],
  );

  const setDefaultPaymentMethod = useCallback(
    async (input: { externalUserId: string; paymentMethodId: string }) => {
      const response = await fetch("/api/pymthouse/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          body.error ?? `Set default payment method failed (${response.status})`,
        );
      }
      await load();
    },
    [load],
  );

  const ensureDefaultPaymentMethod = useCallback(
    async (input: { externalUserId: string }) => {
      const response = await fetch("/api/pymthouse/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalUserId: input.externalUserId,
          ensureDefault: true,
        }),
      });
      const body = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          body.error ??
            `Ensure default payment method failed (${response.status})`,
        );
      }
      await load();
    },
    [load],
  );

  const removePaymentMethod = useCallback(
    async (input: { externalUserId: string; paymentMethodId: string }) => {
      const response = await fetch("/api/pymthouse/payment-methods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          body.error ?? `Remove payment method failed (${response.status})`,
        );
      }
      await load();
    },
    [load],
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
