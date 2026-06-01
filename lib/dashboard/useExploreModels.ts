"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExploreApiResponse } from "@/lib/discovery/types";
import type { Model } from "@/lib/dashboard/types";
import {
  DEFAULT_DISCOVERY_SERVICE_TYPE,
  type DiscoveryServiceType,
} from "@/lib/discovery/constants";

export type { DiscoveryServiceType } from "@/lib/discovery/constants";

type ExploreState =
  | { status: "loading"; models: Model[] }
  | { status: "ready"; models: Model[]; capabilityCount: number; serviceType: string }
  | { status: "error"; models: Model[]; error: string };

let exploreCache: {
  key: string;
  payload: ExploreApiResponse;
  fetchedAt: number;
} | null = null;

const CACHE_TTL_MS = 60_000;

export function useExploreModels(
  serviceType: DiscoveryServiceType = DEFAULT_DISCOVERY_SERVICE_TYPE,
): ExploreState & { reload: () => void } {
  const [state, setState] = useState<ExploreState>({ status: "loading", models: [] });
  const cacheKey = serviceType;

  const load = useCallback(async () => {
    const cached =
      exploreCache &&
      exploreCache.key === cacheKey &&
      Date.now() - exploreCache.fetchedAt < CACHE_TTL_MS
        ? exploreCache.payload
        : null;

    if (cached) {
      setState({
        status: "ready",
        models: cached.models,
        capabilityCount: cached.capabilityCount,
        serviceType: cached.serviceType,
      });
      return;
    }

    setState((prev) => ({ ...prev, status: "loading" }));

    try {
      const params = new URLSearchParams({ serviceType });
      const response = await fetch(`/api/discovery/explore?${params}`);
      const body = (await response.json()) as ExploreApiResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? `Explore fetch failed (${response.status})`);
      }

      exploreCache = { key: cacheKey, payload: body, fetchedAt: Date.now() };
      setState({
        status: "ready",
        models: body.models,
        capabilityCount: body.capabilityCount,
        serviceType: body.serviceType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load capabilities";
      setState({ status: "error", models: [], error: message });
    }
  }, [cacheKey, serviceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    if (exploreCache?.key === cacheKey) {
      exploreCache = null;
    }
    void load();
  }, [cacheKey, load]);

  return { ...state, reload };
}
