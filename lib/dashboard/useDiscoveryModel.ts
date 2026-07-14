"use client";

import { useEffect, useState } from "react";
import type { App } from "@/lib/dashboard/types";
import { DEFAULT_DISCOVERY_SERVICE_TYPE } from "@/lib/discovery/constants";

type ModelState =
  | { status: "loading" }
  | { status: "ready"; model: App }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function useDiscoveryModel(capabilityId: string | undefined): ModelState {
  const [state, setState] = useState<ModelState>({ status: "loading" });

  useEffect(() => {
    if (!capabilityId) {
      setState({ status: "not_found" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    const params = new URLSearchParams({ serviceType: DEFAULT_DISCOVERY_SERVICE_TYPE });
    // Keep `/` as path separators so catch-all `[...id]` can rejoin slash-y
    // capability ids (e.g. livepeer-example/hello-world).
    const encodedId = capabilityId
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const path = `/api/discovery/models/${encodedId}?${params}`;

    void (async () => {
      try {
        const response = await fetch(path);
        const body = (await response.json()) as { model?: App; error?: string };

        if (cancelled) return;

        if (response.status === 404) {
          setState({ status: "not_found" });
          return;
        }
        if (!response.ok || !body.model) {
          setState({
            status: "error",
            message: body.error ?? `Failed to load capability (${response.status})`,
          });
          return;
        }

        setState({ status: "ready", model: body.model });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load capability",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [capabilityId]);

  return state;
}
