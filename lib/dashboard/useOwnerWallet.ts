"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardOwnerWallet,
  DashboardWalletInvoice,
  DashboardWalletPaymentMethod,
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

/** Map missing/unroutable upstream wallet APIs to an actionable message. */
function walletUpstreamMessage(status: number, upstreamError?: string): string {
  if (status === 404 || status === 405) {
    return (
      `PymtHouse owner wallet API is unavailable (${status}). ` +
      "Deploy the /apps/{clientId}/billing/wallet routes (pymthouse PR #399) " +
      "to this environment and check the M2M client credentials."
    );
  }
  return upstreamError ?? `Wallet request failed (${status})`;
}

export type OwnerWalletState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      wallet: DashboardOwnerWallet;
      paymentMethods: DashboardWalletPaymentMethod[];
      invoices: DashboardWalletInvoice[];
    }
  | { status: "error"; message: string };

export type WalletBillingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; wallet: DashboardOwnerWallet }
  | { status: "error"; message: string };

/** Wallet GET only — remaining included usage + plan, without PM/invoice lists. */
export function useWalletBillingState(externalUserId: string | undefined) {
  const [state, setState] = useState<WalletBillingState>({ status: "idle" });
  const trimmedUserId = externalUserId?.trim() || "";

  const load = useCallback(async () => {
    if (!trimmedUserId) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    try {
      const qs = `externalUserId=${encodeURIComponent(trimmedUserId)}`;
      const walletResponse = await fetch(`/api/pymthouse/wallet?${qs}`);
      const walletBody = await readResponseJson<
        DashboardOwnerWallet & { error?: string }
      >(walletResponse);
      if (!walletResponse.ok) {
        throw new Error(
          walletUpstreamMessage(walletResponse.status, walletBody.error),
        );
      }
      setState({ status: "ready", wallet: walletBody });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load wallet",
      });
    }
  }, [trimmedUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}

export function useOwnerWallet(
  enabled: boolean,
  externalUserId: string | undefined,
) {
  const [state, setState] = useState<OwnerWalletState>({ status: "idle" });
  const trimmedUserId = externalUserId?.trim() || "";

  const load = useCallback(async () => {
    if (!enabled || !trimmedUserId) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    try {
      const qs = `externalUserId=${encodeURIComponent(trimmedUserId)}`;
      const [walletResponse, pmResponse, invResponse] = await Promise.all([
        fetch(`/api/pymthouse/wallet?${qs}`),
        fetch(`/api/pymthouse/wallet/payment-methods?${qs}`),
        fetch(`/api/pymthouse/wallet/invoices?${qs}&pageSize=20`),
      ]);

      const walletBody = await readResponseJson<
        DashboardOwnerWallet & { error?: string }
      >(walletResponse);
      if (!walletResponse.ok) {
        throw new Error(
          walletUpstreamMessage(walletResponse.status, walletBody.error),
        );
      }

      const pmBody = await readResponseJson<{
        paymentMethods?: DashboardWalletPaymentMethod[];
        error?: string;
      }>(pmResponse);
      if (!pmResponse.ok) {
        throw new Error(walletUpstreamMessage(pmResponse.status, pmBody.error));
      }

      const invBody = await readResponseJson<{
        items?: DashboardWalletInvoice[];
        error?: string;
      }>(invResponse);
      if (!invResponse.ok) {
        throw new Error(
          walletUpstreamMessage(invResponse.status, invBody.error),
        );
      }

      setState({
        status: "ready",
        wallet: walletBody,
        paymentMethods: pmBody.paymentMethods ?? [],
        invoices: invBody.items ?? [],
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load wallet",
      });
    }
  }, [enabled, trimmedUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startTopUp = useCallback(
    async (input: { amountUsd: string }) => {
      if (!trimmedUserId) {
        throw new Error("externalUserId is required");
      }
      const response = await fetch("/api/pymthouse/wallet/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalUserId: trimmedUserId,
          amountUsd: input.amountUsd,
          successUrl: `${window.location.origin}/usage?topup=succeeded`,
          cancelUrl: `${window.location.origin}/usage?topup=canceled`,
        }),
      });
      const body = await readResponseJson<{
        checkoutUrl?: string;
        error?: string;
      }>(response);
      if (!response.ok || !body.checkoutUrl) {
        throw new Error(body.error ?? `Top-up failed (${response.status})`);
      }
      return { checkoutUrl: body.checkoutUrl };
    },
    [trimmedUserId],
  );

  const startPaymentMethodCheckout = useCallback(async () => {
    if (!trimmedUserId) {
      throw new Error("externalUserId is required");
    }
    const response = await fetch("/api/pymthouse/wallet/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalUserId: trimmedUserId,
        successUrl: `${window.location.origin}/usage?topup=pm-saved`,
        cancelUrl: `${window.location.origin}/usage?topup=canceled`,
      }),
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
  }, [trimmedUserId]);

  const ensureDefaultPaymentMethod = useCallback(async () => {
    if (!trimmedUserId) {
      throw new Error("externalUserId is required");
    }
    const response = await fetch("/api/pymthouse/wallet/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalUserId: trimmedUserId,
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
  }, [trimmedUserId, load]);

  return {
    state,
    reload: load,
    startTopUp,
    startPaymentMethodCheckout,
    ensureDefaultPaymentMethod,
  };
}
