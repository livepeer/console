"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountUsagePayload } from "@/lib/console/account-usage";
import {
  errorMessageFromBody,
  isAccountUsagePayload,
} from "@/lib/console/account-usage-payload";

type AccountUsageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: AccountUsagePayload }
  | { status: "error"; message: string };

type UseAccountUsageOptions = {
  periodDays?: number;
  window?: "rolling" | "mtd";
  includePrior?: boolean;
};

function normalizeOptions(
  periodDaysOrOptions: number | UseAccountUsageOptions = 30
): Required<
  Pick<UseAccountUsageOptions, "periodDays" | "window" | "includePrior">
> {
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
  enabled: boolean,
  periodDaysOrOptions: number | UseAccountUsageOptions = 30
) {
  const options = normalizeOptions(periodDaysOrOptions);
  const [state, setState] = useState<AccountUsageState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({
        status: "error",
        message: "Sign in to load usage for your account.",
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({
        days: String(options.periodDays),
        window: options.window,
        includePrior: options.includePrior ? "1" : "0",
      });
      const response = await fetch(`/api/pymthouse/account-usage?${params}`, {
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          errorMessageFromBody(body) ??
            `Usage fetch failed (${response.status})`
        );
      }
      if (!isAccountUsagePayload(body)) {
        throw new Error("Usage response was malformed.");
      }
      setState({ status: "ready", data: body });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load usage",
      });
    }
  }, [enabled, options.periodDays, options.window, options.includePrior]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
