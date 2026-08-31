"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardOwnerWallet,
  DashboardWalletInvoice,
  DashboardWalletPaymentMethod,
} from "@/lib/console/pymthouse-wallet";
import { readResponseJson } from "@/lib/console/read-response-json";

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

type OwnerWalletState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      wallet: DashboardOwnerWallet;
      paymentMethods: DashboardWalletPaymentMethod[];
      invoices: DashboardWalletInvoice[];
    }
  | { status: "error"; message: string };

type WalletBillingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; wallet: DashboardOwnerWallet }
  | { status: "error"; message: string };

/**
 * Start a Stripe Checkout top-up. `returnPath` is where Checkout sends the
 * browser back to; pass the page the user started from so they are not
 * dropped somewhere else on return.
 */
export async function startWalletTopUp(input: {
  amountUsd: string;
  returnPath?: string;
}): Promise<{ checkoutUrl: string }> {
  const path = input.returnPath ?? "/usage";
  const join = path.includes("?") ? "&" : "?";
  const response = await fetch("/api/pymthouse/wallet/top-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amountUsd: input.amountUsd,
      successUrl: `${window.location.origin}${path}${join}topup=succeeded`,
      cancelUrl: `${window.location.origin}${path}${join}topup=canceled`,
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
}

/** Wallet GET only — remaining included usage + plan, without PM/invoice lists. */
export function useWalletBillingState(enabled: boolean) {
  const [state, setState] = useState<WalletBillingState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    try {
      const walletResponse = await fetch("/api/pymthouse/wallet");
      const walletBody = await readResponseJson<
        DashboardOwnerWallet & { error?: string }
      >(walletResponse);
      if (!walletResponse.ok) {
        throw new Error(
          walletUpstreamMessage(walletResponse.status, walletBody.error)
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
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}

export function useOwnerWallet(enabled: boolean) {
  const [state, setState] = useState<OwnerWalletState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    try {
      const [walletResponse, pmResponse, invResponse] = await Promise.all([
        fetch("/api/pymthouse/wallet"),
        fetch("/api/pymthouse/wallet/payment-methods"),
        fetch("/api/pymthouse/wallet/invoices?pageSize=20"),
      ]);

      const walletBody = await readResponseJson<
        DashboardOwnerWallet & { error?: string }
      >(walletResponse);
      if (!walletResponse.ok) {
        throw new Error(
          walletUpstreamMessage(walletResponse.status, walletBody.error)
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
          walletUpstreamMessage(invResponse.status, invBody.error)
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
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const startTopUp = useCallback(
    (input: { amountUsd: string }) => startWalletTopUp(input),
    []
  );

  const startPaymentMethodCheckout = useCallback(async () => {
    const response = await fetch("/api/pymthouse/wallet/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        body.error ?? `Payment method checkout failed (${response.status})`
      );
    }
    return { checkoutUrl: body.checkoutUrl };
  }, []);

  const ensureDefaultPaymentMethod = useCallback(async () => {
    const response = await fetch("/api/pymthouse/wallet/payment-methods", {
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

  return {
    state,
    reload: load,
    startTopUp,
    startPaymentMethodCheckout,
    ensureDefaultPaymentMethod,
  };
}
