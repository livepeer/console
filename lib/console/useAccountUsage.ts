"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountUsagePayload } from "@/lib/console/account-usage";
import {
  errorMessageFromBody,
  isAccountUsagePayload,
} from "@/lib/console/account-usage-payload";

/** Windows change once a day; a short TTL makes tab-switching free. */
const CACHE_TTL_MS = 60_000;

type CacheEntry = { data: AccountUsagePayload; at: number };

const usageCache = new Map<string, CacheEntry>();
const usageInFlight = new Map<string, Promise<AccountUsagePayload>>();

async function fetchUsageWindow(
  key: string,
  params: URLSearchParams
): Promise<AccountUsagePayload> {
  const existing = usageInFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(`/api/pymthouse/account-usage?${params}`, {
      cache: "no-store",
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error(
        errorMessageFromBody(body) ?? `Usage fetch failed (${response.status})`
      );
    }
    if (!isAccountUsagePayload(body)) {
      throw new Error("Usage response was malformed.");
    }
    usageCache.set(key, { data: body, at: Date.now() });
    return body;
  })().finally(() => {
    usageInFlight.delete(key);
  });

  usageInFlight.set(key, request);
  return request;
}

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

  // Per-window cache. Switching 30d → 7d → 30d used to fire three requests for
  // two distinct results, and blanked the page each time. A cached window
  // renders immediately and revalidates behind the current view.
  // Only the newest request may commit, so fast tab switching cannot land an
  // earlier response on top of a later one.
  const requestId = useRef(0);

  const cacheKey = `${options.periodDays}|${options.window}|${options.includePrior}`;

  const load = useCallback(
    async (force = false) => {
      if (!enabled) {
        setState({
          status: "error",
          message: "Sign in to load usage for your account.",
        });
        return;
      }

      const id = ++requestId.current;
      const cached = usageCache.get(cacheKey);
      const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;

      if (cached) {
        setState({ status: "ready", data: cached.data });
        // Still warm — no request at all.
        if (fresh && !force) return;
      } else {
        setState({ status: "loading" });
      }

      if (force) usageCache.delete(cacheKey);

      try {
        const params = new URLSearchParams({
          days: String(options.periodDays),
          window: options.window,
          includePrior: options.includePrior ? "1" : "0",
        });
        const data = await fetchUsageWindow(cacheKey, params);
        if (id !== requestId.current) return;
        setState({ status: "ready", data });
      } catch (error) {
        if (id !== requestId.current) return;
        // A failed revalidation should not throw away a good cached window.
        if (cached) return;
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load usage",
        });
      }
    },
    [enabled, cacheKey, options.periodDays, options.window, options.includePrior]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => load(true), [load]);

  return { ...state, reload };
}
