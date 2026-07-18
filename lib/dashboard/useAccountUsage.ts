"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountUsagePayload } from "@/lib/dashboard/pymthouse-bff";

export type AccountUsageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: AccountUsagePayload }
  | { status: "error"; message: string };

export type UseAccountUsageOptions = {
  periodDays?: number;
  window?: "rolling" | "mtd";
  includePrior?: boolean;
};

function normalizeOptions(
  periodDaysOrOptions: number | UseAccountUsageOptions = 30,
): Required<Pick<UseAccountUsageOptions, "periodDays" | "window" | "includePrior">> {
  if (typeof periodDaysOrOptions === "number") {
    return {
      periodDays: periodDaysOrOptions,
      window: "rolling",
      includePrior: true,
    };
  }
  return {
    periodDays: periodDaysOrOptions.periodDays ?? 30,
    window: periodDaysOrOptions.window ?? "rolling",
    includePrior: periodDaysOrOptions.includePrior !== false,
  };
}

export function useAccountUsage(
  externalUserId: string | undefined,
  periodDaysOrOptions: number | UseAccountUsageOptions = 30,
) {
  const options = normalizeOptions(periodDaysOrOptions);
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
        days: String(options.periodDays),
        window: options.window,
        includePrior: options.includePrior ? "1" : "0",
      });
      const response = await fetch(`/api/pymthouse/account-usage?${params}`, {
        cache: "no-store",
      });
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
  }, [
    externalUserId,
    options.periodDays,
    options.window,
    options.includePrior,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
