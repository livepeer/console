"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardBillingPlan,
  DashboardUserSubscription,
} from "@/lib/dashboard/pymthouse-billing-bff";

export type BillingPlansState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      plans: DashboardBillingPlan[];
      subscription: DashboardUserSubscription | null;
    }
  | { status: "error"; message: string };

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

export function useBillingPlans(externalUserId: string | undefined) {
  const [state, setState] = useState<BillingPlansState>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const plansResponse = await fetch("/api/pymthouse/plans");
      const plansBody = await readResponseJson<{
        plans?: DashboardBillingPlan[];
        error?: string;
      }>(plansResponse);
      if (!plansResponse.ok) {
        throw new Error(
          plansBody.error ?? `Plans fetch failed (${plansResponse.status})`
        );
      }

      let subscription: DashboardUserSubscription | null = null;
      const trimmedUserId = externalUserId?.trim();
      if (trimmedUserId) {
        const subResponse = await fetch(
          `/api/pymthouse/subscription?externalUserId=${encodeURIComponent(trimmedUserId)}`
        );
        const subBody = await readResponseJson<{
          subscription?: DashboardUserSubscription;
          error?: string;
        }>(subResponse);
        if (subResponse.ok) {
          subscription = subBody.subscription ?? null;
        }
      }

      setState({
        status: "ready",
        plans: plansBody.plans ?? [],
        subscription,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load plans",
      });
    }
  }, [externalUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribe = useCallback(
    async (input: {
      planId: string;
      externalUserId: string;
      successUrl?: string;
      cancelUrl?: string;
    }) => {
      const response = await fetch("/api/pymthouse/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readResponseJson<{
        checkoutUrl?: string;
        subscriptionId?: string;
        error?: string;
      }>(response);
      if (!response.ok || !body.checkoutUrl) {
        throw new Error(body.error ?? `Subscribe failed (${response.status})`);
      }
      return {
        checkoutUrl: body.checkoutUrl,
        subscriptionId: body.subscriptionId,
      };
    },
    []
  );

  const changePlan = useCallback(
    async (input: {
      planId: string;
      externalUserId: string;
      successUrl?: string;
      cancelUrl?: string;
    }) => {
      const response = await fetch("/api/pymthouse/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readResponseJson<{
        checkoutUrl?: string;
        subscriptionId?: string;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(
          body.error ?? `Plan change failed (${response.status})`
        );
      }
      return {
        checkoutUrl: body.checkoutUrl,
        subscriptionId: body.subscriptionId,
      };
    },
    []
  );

  return { state, reload: load, subscribe, changePlan };
}
