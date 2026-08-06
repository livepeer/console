"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardBillingPlan } from "@/lib/dashboard/pymthouse-billing-bff";

export type BillingPlansState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; plans: DashboardBillingPlan[] }
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

export function useBillingPlans() {
  const [state, setState] = useState<BillingPlansState>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/pymthouse/plans");
      const body = await readResponseJson<{
        plans?: DashboardBillingPlan[];
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? `Plans fetch failed (${response.status})`);
      }
      setState({ status: "ready", plans: body.plans ?? [] });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load plans",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribe = useCallback(
    async (input: { planId: string; externalUserId: string }) => {
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
    [],
  );

  return { state, reload: load, subscribe };
}
