"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardInvoice,
  DashboardPaymentMethod,
} from "@/lib/dashboard/pymthouse-billing-bff";

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

export type BillingAccountState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      paymentMethods: DashboardPaymentMethod[];
      invoices: DashboardInvoice[];
    }
  | { status: "error"; message: string };

export function useBillingAccount(externalUserId: string | undefined) {
  const [state, setState] = useState<BillingAccountState>({ status: "idle" });

  const load = useCallback(async () => {
    const trimmed = externalUserId?.trim();
    if (!trimmed) {
      setState({
        status: "ready",
        paymentMethods: [],
        invoices: [],
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const q = encodeURIComponent(trimmed);
      const [pmResponse, invResponse] = await Promise.all([
        fetch(`/api/pymthouse/payment-methods?externalUserId=${q}`),
        fetch(`/api/pymthouse/invoices?externalUserId=${q}&pageSize=20`),
      ]);

      const pmBody = await readResponseJson<{
        paymentMethods?: DashboardPaymentMethod[];
        error?: string;
      }>(pmResponse);
      if (!pmResponse.ok) {
        throw new Error(
          pmBody.error ?? `Payment methods failed (${pmResponse.status})`,
        );
      }

      const invBody = await readResponseJson<{
        items?: DashboardInvoice[];
        error?: string;
      }>(invResponse);
      if (!invResponse.ok) {
        throw new Error(
          invBody.error ?? `Invoices failed (${invResponse.status})`,
        );
      }

      setState({
        status: "ready",
        paymentMethods: pmBody.paymentMethods ?? [],
        invoices: invBody.items ?? [],
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load billing",
      });
    }
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
    removePaymentMethod,
  };
}
