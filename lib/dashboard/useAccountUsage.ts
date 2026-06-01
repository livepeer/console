"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountUsagePayload } from "@/lib/dashboard/pymthouse-bff";

export type AccountUsageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: AccountUsagePayload }
  | { status: "error"; message: string };

export function useAccountUsage(externalUserId: string | undefined, periodDays = 30) {
  const [state, setState] = useState<AccountUsageState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!externalUserId?.trim()) {
      setState({ status: "error", message: "Sign in to load usage for your account." });
      return;
    }

    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({
        externalUserId: externalUserId.trim(),
        days: String(periodDays),
      });
      const response = await fetch(`/api/pymthouse/account-usage?${params}`);
      const body = (await response.json()) as AccountUsagePayload & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Usage fetch failed (${response.status})`);
      }
      setState({ status: "ready", data: body });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load usage",
      });
    }
  }, [externalUserId, periodDays]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
