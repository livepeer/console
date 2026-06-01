"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardApiKeyRow } from "@/lib/dashboard/pymthouse-keys-bff";

export type ApiKeysState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; keys: DashboardApiKeyRow[] }
  | { status: "error"; message: string };

export function useApiKeys(externalUserId: string | undefined) {
  const [state, setState] = useState<ApiKeysState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!externalUserId?.trim()) {
      setState({
        status: "error",
        message: "Sign in to manage API keys for your account.",
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({ externalUserId: externalUserId.trim() });
      const response = await fetch(`/api/pymthouse/keys?${params}`);
      const body = (await response.json()) as { keys?: DashboardApiKeyRow[]; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `API keys fetch failed (${response.status})`);
      }
      setState({ status: "ready", keys: body.keys ?? [] });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load API keys",
      });
    }
  }, [externalUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createKey = useCallback(
    async (label?: string) => {
      if (!externalUserId?.trim()) {
        throw new Error("Sign in required");
      }
      const response = await fetch("/api/pymthouse/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalUserId: externalUserId.trim(),
          label,
        }),
      });
      const body = (await response.json()) as {
        apiKey?: string;
        row?: DashboardApiKeyRow;
        error?: string;
      };
      if (!response.ok || !body.apiKey) {
        throw new Error(body.error ?? `Create failed (${response.status})`);
      }
      await load();
      return body.apiKey;
    },
    [externalUserId, load],
  );

  const revokeKey = useCallback(
    async (keyId: string) => {
      if (!externalUserId?.trim()) {
        throw new Error("Sign in required");
      }
      const params = new URLSearchParams({
        externalUserId: externalUserId.trim(),
        keyId,
      });
      const response = await fetch(`/api/pymthouse/keys?${params}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Revoke failed (${response.status})`);
      }
      await load();
    },
    [externalUserId, load],
  );

  return { state, reload: load, createKey, revokeKey };
}
