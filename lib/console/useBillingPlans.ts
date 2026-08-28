"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardBillingPlan,
  DashboardScheduledChangeConflict,
  DashboardUserSubscription,
} from "@/lib/console/pymthouse-billing";
import { readResponseJson } from "@/lib/console/read-response-json";

type BillingPlansState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      plans: DashboardBillingPlan[];
      subscription: DashboardUserSubscription | null;
    }
  | { status: "error"; message: string };

export class ResumeSubscriptionError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code: string | undefined) {
    super(message);
    this.name = "ResumeSubscriptionError";
    this.status = status;
    this.code = code;
  }
}

export class ScheduledChangeConflictError extends Error {
  readonly code = "scheduled_change_exists" as const;
  readonly conflict: DashboardScheduledChangeConflict;

  constructor(conflict: DashboardScheduledChangeConflict) {
    super(conflict.error || "A plan change is already scheduled");
    this.name = "ScheduledChangeConflictError";
    this.conflict = conflict;
  }
}

export function useBillingPlans(enabled: boolean) {
  const [state, setState] = useState<BillingPlansState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ status: "error", message: "Sign in to load billing plans." });
      return;
    }
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
      const subResponse = await fetch("/api/pymthouse/subscription");
      const subBody = await readResponseJson<{
        subscription?: DashboardUserSubscription;
        error?: string;
      }>(subResponse);
      if (subResponse.ok) {
        subscription = subBody.subscription ?? null;
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
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribe = useCallback(
    async (input: {
      planId: string;
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
      if (!response.ok) {
        throw new Error(body.error ?? `Subscribe failed (${response.status})`);
      }
      if (!body.checkoutUrl && !body.subscriptionId) {
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
      successUrl?: string;
      cancelUrl?: string;
      timing?: string;
      effectiveAt?: string;
      confirmReplaceScheduled?: boolean;
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
        code?: string;
        timingOptions?: DashboardScheduledChangeConflict["timingOptions"];
        scheduledSubscriptionId?: string | null;
        scheduledPlanKey?: string | null;
        scheduledActiveFrom?: string | null;
      }>(response);
      if (response.status === 409 && body.code === "scheduled_change_exists") {
        throw new ScheduledChangeConflictError({
          code: "scheduled_change_exists",
          error: body.error ?? "A plan change is already scheduled",
          timingOptions: body.timingOptions ?? null,
          scheduledSubscriptionId: body.scheduledSubscriptionId ?? null,
          scheduledPlanKey: body.scheduledPlanKey ?? null,
          scheduledActiveFrom: body.scheduledActiveFrom ?? null,
        });
      }
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

  const cancelSubscription = useCallback(
    async (opts?: { timing?: string; effectiveAt?: string }) => {
      const response = await fetch("/api/pymthouse/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts ?? {}),
      });
      const body = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? `Cancel failed (${response.status})`);
      }
    },
    []
  );

  const resumeSubscription = useCallback(async () => {
    const response = await fetch("/api/pymthouse/subscription/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const body = await readResponseJson<{ error?: string; code?: string }>(
      response
    );
    if (!response.ok) {
      throw new ResumeSubscriptionError(
        body.error ?? `Resume failed (${response.status})`,
        response.status,
        body.code
      );
    }
  }, []);

  return {
    state,
    reload: load,
    subscribe,
    changePlan,
    cancelSubscription,
    resumeSubscription,
  };
}
