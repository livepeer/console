"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountRequestsPayload } from "@/lib/console/account-usage";
import { createClientCache } from "@/lib/console/client-cache";
import { mapSignedTicketToActivityRow } from "@/lib/console/signed-ticket-activity";
import type { AccountActivityRow } from "@/lib/console/types";

type ReadyState = {
  status: "ready";
  rows: AccountActivityRow[];
  nextCursor: string | null;
  openMeterConfigured: boolean;
  /** Set when a further page failed to load. The rows already on screen
   *  are kept; only the append is retried. */
  loadMoreError: string | null;
};

type AccountRequestsState =
  | { status: "idle" }
  | { status: "loading" }
  | ReadyState
  | { status: "error"; message: string };

/** New calls land within a minute; a short TTL keeps navigation free. */
const CACHE_TTL_MS = 60_000;
const CACHE_KEY = "account-requests";

/** Holds the list as last shown, including any pages appended via loadMore. */
const requestsCache = createClientCache<ReadyState>(CACHE_TTL_MS);

const HISTORY_PERIOD_DAYS = 30;

async function fetchRequestsPage(
  cursor?: string | null
): Promise<Omit<ReadyState, "loadMoreError">> {
  const params = new URLSearchParams({
    limit: "50",
    days: String(HISTORY_PERIOD_DAYS),
  });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/pymthouse/account-requests?${params}`, {
    cache: "no-store",
  });
  const body = (await response.json()) as AccountRequestsPayload & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error ?? `Requests fetch failed (${response.status})`);
  }
  return {
    status: "ready",
    rows: body.items.map(mapSignedTicketToActivityRow),
    nextCursor: body.nextCursor,
    openMeterConfigured: body.openMeterConfigured !== false,
  };
}

export function useAccountRequests(enabled: boolean) {
  // Seeded from the module cache so a remount paints the last list on its
  // first frame; the first page then revalidates behind it when stale.
  const [state, setState] = useState<AccountRequestsState>(() => {
    const cached = enabled ? requestsCache.peek(CACHE_KEY) : undefined;
    return cached ? cached.data : { status: "idle" };
  });
  const requestId = useRef(0);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) {
        setState({
          status: "error",
          message: "Sign in to load signed-ticket requests.",
        });
        return;
      }

      const id = ++requestId.current;
      const cached = requestsCache.peek(CACHE_KEY);

      if (cached) {
        setState(cached.data);
        if (requestsCache.isFresh(cached) && !force) return;
      } else {
        setState({ status: "loading" });
      }

      if (force) requestsCache.delete(CACHE_KEY);

      try {
        const page = await requestsCache.fetch(CACHE_KEY, async () => ({
          ...(await fetchRequestsPage(null)),
          loadMoreError: null,
        }));
        if (id !== requestId.current) return;
        setState(page);
      } catch (error) {
        if (id !== requestId.current) return;
        // A failed revalidation should not throw away a good cached list.
        if (cached) return;
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load requests",
        });
      }
    },
    [enabled]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (state.status !== "ready" || !state.nextCursor) return;
    const id = ++requestId.current;
    try {
      const page = await fetchRequestsPage(state.nextCursor);
      if (id !== requestId.current) return;
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        const next: ReadyState = {
          ...page,
          rows: [...prev.rows, ...page.rows],
          loadMoreError: null,
        };
        requestsCache.set(CACHE_KEY, next);
        return next;
      });
    } catch (error) {
      if (id !== requestId.current) return;
      const message =
        error instanceof Error ? error.message : "Failed to load requests";
      setState((prev) =>
        prev.status === "ready" ? { ...prev, loadMoreError: message } : prev
      );
    }
  }, [state]);

  const reload = useCallback(() => load(true), [load]);

  return { ...state, reload, loadMore };
}
