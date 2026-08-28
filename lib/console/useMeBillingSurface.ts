"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeBillingSurface } from "@/lib/console/pymthouse-me-billing-bff";
import { readResponseJson } from "@/lib/console/read-response-json";

type MeBillingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; surface: MeBillingSurface }
  | { status: "error"; message: string };

/** End-user `/me/billing` surface from the minted JWT's `billing_mode`. */
export function useMeBillingSurface(enabled: boolean) {
  const [state, setState] = useState<MeBillingState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await fetch("/api/pymthouse/me-billing", {
        cache: "no-store",
      });
      const body = await readResponseJson<MeBillingSurface & { error?: string }>(
        response
      );
      if (!response.ok) {
        throw new Error(body.error ?? `Me billing failed (${response.status})`);
      }
      setState({ status: "ready", surface: body });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load me billing",
      });
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
