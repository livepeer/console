"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountRequestsPayload } from "@/lib/console/account-usage";
import { mapSignedTicketToActivityRow } from "@/lib/console/signed-ticket-activity";
import type { AccountActivityRow } from "@/lib/console/types";

type AccountRequestsState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      rows: AccountActivityRow[];
      nextCursor: string | null;
      openMeterConfigured: boolean;
      /** Set when a further page failed to load. The rows already on screen
       *  are kept; only the append is retried. */
      loadMoreError: string | null;
    }
  | { status: "error"; message: string };

export function useAccountRequests(enabled: boolean) {
  const [state, setState] = useState<AccountRequestsState>({ status: "idle" });

  const load = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!enabled) {
        setState({
          status: "error",
          message: "Sign in to load signed-ticket requests.",
        });
        return;
      }

      if (!append) {
        setState({ status: "loading" });
      }

      try {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("cursor", cursor);

        const response = await fetch(
          `/api/pymthouse/account-requests?${params}`,
          {
            cache: "no-store",
          }
        );
        const body = (await response.json()) as AccountRequestsPayload & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            body.error ?? `Requests fetch failed (${response.status})`
          );
        }

        const mapped = body.items.map(mapSignedTicketToActivityRow);
        setState((prev) => {
          const priorRows = append && prev.status === "ready" ? prev.rows : [];
          return {
            status: "ready",
            rows: append ? [...priorRows, ...mapped] : mapped,
            nextCursor: body.nextCursor,
            openMeterConfigured: body.openMeterConfigured !== false,
            loadMoreError: null,
          };
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load requests";
        setState((prev) =>
          append && prev.status === "ready"
            ? { ...prev, loadMoreError: message }
            : { status: "error", message }
        );
      }
    },
    [enabled]
  );

  useEffect(() => {
    void load(null, false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (state.status !== "ready" || !state.nextCursor) return;
    await load(state.nextCursor, true);
  }, [load, state]);

  return { ...state, reload: () => load(null, false), loadMore };
}
