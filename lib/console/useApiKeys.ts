"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardApiKeyRow } from "@/lib/console/pymthouse-keys";
import { readResponseJson } from "@/lib/console/read-response-json";

type ApiKeysState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; keys: DashboardApiKeyRow[] }
  | { status: "error"; message: string };

export function useApiKeys(enabled: boolean) {
  const [state, setState] = useState<ApiKeysState>({ status: "idle" });

  const load = useCallback(
    async (options?: { soft?: boolean }) => {
      if (!enabled) {
        setState({
          status: "error",
          message: "Sign in to manage API keys for your account.",
        });
        return;
      }

      const soft = options?.soft === true;
      if (!soft) {
        setState({ status: "loading" });
      }
      try {
        const response = await fetch("/api/pymthouse/keys");
        const body = await readResponseJson<{
          keys?: DashboardApiKeyRow[];
          error?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(
            body.error ?? `API keys fetch failed (${response.status})`
          );
        }
        setState({ status: "ready", keys: body.keys ?? [] });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load API keys";
        setState((prev) => {
          if (soft && prev.status === "ready") {
            return prev;
          }
          return { status: "error", message };
        });
      }
    },
    [enabled]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const createKey = useCallback(
    async (label?: string) => {
      if (!enabled) {
        throw new Error("Sign in required");
      }
      const response = await fetch("/api/pymthouse/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = await readResponseJson<{
        apiKey?: string;
        sdkToken?: string | null;
        row?: DashboardApiKeyRow;
        error?: string;
      }>(response);
      if (!response.ok || !body.apiKey || !body.row) {
        throw new Error(body.error ?? `Create failed (${response.status})`);
      }
      return {
        apiKey: body.apiKey,
        id: body.row.id,
        row: body.row,
        sdkToken:
          typeof body.sdkToken === "string" && body.sdkToken.trim()
            ? body.sdkToken.trim()
            : null,
      };
    },
    [enabled]
  );

  const insertKey = useCallback((row: DashboardApiKeyRow) => {
    setState((prev) => {
      const existing = prev.status === "ready" ? prev.keys : [];
      return {
        status: "ready",
        keys: [
          row,
          ...existing.filter((existingRow) => existingRow.id !== row.id),
        ],
      };
    });
  }, []);

  const revokeKey = useCallback(
    async (keyId: string) => {
      if (!enabled) {
        throw new Error("Sign in required");
      }
      const params = new URLSearchParams({ keyId });
      const response = await fetch(`/api/pymthouse/keys?${params}`, {
        method: "DELETE",
      });
      const body = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? `Revoke failed (${response.status})`);
      }
      setState((prev) => {
        if (prev.status !== "ready") {
          return prev;
        }
        return {
          status: "ready",
          keys: prev.keys.filter((row) => row.id !== keyId),
        };
      });
      await load({ soft: true });
    },
    [enabled, load]
  );

  return { state, reload: load, createKey, insertKey, revokeKey };
}
