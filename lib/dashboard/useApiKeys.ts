"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardApiKeyRow } from "@/lib/dashboard/pymthouse-keys-bff";

export type ApiKeysState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; keys: DashboardApiKeyRow[] }
  | { status: "error"; message: string };

async function readResponseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Empty response (${response.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from API keys endpoint (${response.status})`);
  }
}

export function useApiKeys(
  externalUserId: string | undefined,
  email?: string | undefined,
) {
  const [state, setState] = useState<ApiKeysState>({ status: "idle" });

  const load = useCallback(
    async (options?: { soft?: boolean }) => {
      if (!externalUserId?.trim()) {
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
        const params = new URLSearchParams({ externalUserId: externalUserId.trim() });
        if (email?.trim()) params.set("email", email.trim());
        const response = await fetch(`/api/pymthouse/keys?${params}`);
        const body = await readResponseJson<{
          keys?: DashboardApiKeyRow[];
          error?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(body.error ?? `API keys fetch failed (${response.status})`);
        }
        setState({ status: "ready", keys: body.keys ?? [] });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load API keys";
        setState((prev) => {
          // Soft reload after create/revoke: keep existing rows instead of
          // replacing the page with a raw parse error banner.
          if (soft && prev.status === "ready") {
            return prev;
          }
          return { status: "error", message };
        });
      }
    },
    [email, externalUserId],
  );

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
          ...(email?.trim() ? { email: email.trim() } : {}),
          label,
        }),
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
      // Show the new row immediately so a soft-list failure cannot blank the table.
      setState((prev) => {
        const existing = prev.status === "ready" ? prev.keys : [];
        return {
          status: "ready",
          keys: [body.row!, ...existing.filter((row) => row.id !== body.row!.id)],
        };
      });
      await load({ soft: true });
      return {
        apiKey: body.apiKey,
        sdkToken:
          typeof body.sdkToken === "string" && body.sdkToken.trim()
            ? body.sdkToken.trim()
            : null,
      };
    },
    [email, externalUserId, load],
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
    [externalUserId, load],
  );

  return { state, reload: load, createKey, revokeKey };
}
