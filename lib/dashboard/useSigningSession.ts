"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSigningToken } from "@/lib/dashboard/fetch-signing-token";
import {
  clearStoredSigningToken,
  getStoredSigningToken,
  setStoredSigningToken,
} from "@/lib/dashboard/signing-token-storage";

export type SigningSessionState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      accessToken: string;
      expiresAtMs: number;
      scope: string;
    }
  | { status: "missing_user" }
  | { status: "error"; message: string };

const REFRESH_RATIO = 0.8;
const MIN_REFRESH_LEAD_MS = 30_000;

function refreshDelayMs(expiresInSec: number): number {
  const ttlMs = expiresInSec * 1000;
  return Math.max(MIN_REFRESH_LEAD_MS, Math.floor(ttlMs * REFRESH_RATIO));
}

export function useSigningSession(enabled: boolean, externalUserId: string | undefined) {
  const [state, setState] = useState<SigningSessionState>({ status: "idle" });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const mintToken = useCallback(
    async (userId: string, options?: { skipCache?: boolean }): Promise<string> => {
      const trimmed = userId.trim();
      userIdRef.current = trimmed;

      if (!options?.skipCache) {
        const cached = getStoredSigningToken(trimmed);
        if (cached) {
          setState({
            status: "ready",
            accessToken: cached.accessToken,
            expiresAtMs: cached.expiresAtMs,
            scope: cached.scope,
          });
          const remainingMs = cached.expiresAtMs - Date.now();
          clearRefreshTimer();
          refreshTimerRef.current = setTimeout(() => {
            if (userIdRef.current === trimmed) {
              void mintToken(trimmed, { skipCache: true });
            }
          }, Math.max(MIN_REFRESH_LEAD_MS, Math.floor(remainingMs * REFRESH_RATIO)));
          return cached.accessToken;
        }
      }

      setState({ status: "loading" });
      try {
        const minted = await fetchSigningToken(trimmed);
        const expiresAtMs = Date.now() + minted.expires_in * 1000;
        setStoredSigningToken({
          externalUserId: trimmed,
          accessToken: minted.access_token,
          expiresAtMs,
          scope: minted.scope,
        });
        setState({
          status: "ready",
          accessToken: minted.access_token,
          expiresAtMs,
          scope: minted.scope,
        });

        clearRefreshTimer();
        refreshTimerRef.current = setTimeout(() => {
          if (userIdRef.current === trimmed) {
            void mintToken(trimmed, { skipCache: true });
          }
        }, refreshDelayMs(minted.expires_in));

        return minted.access_token;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Signing token mint failed";
        setState({ status: "error", message });
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [clearRefreshTimer],
  );

  const bootstrap = useCallback(async () => {
    const userId = externalUserId?.trim();
    if (!userId) {
      setState({ status: "missing_user" });
      return;
    }
    await mintToken(userId);
  }, [externalUserId, mintToken]);

  const ensureAccessToken = useCallback(async () => {
    if (
      state.status === "ready" &&
      state.expiresAtMs > Date.now() + 5_000 &&
      userIdRef.current === externalUserId?.trim()
    ) {
      return state.accessToken;
    }
    const userId = externalUserId?.trim();
    if (!userId) {
      throw new Error("Sign in to stream");
    }
    return mintToken(userId);
  }, [externalUserId, mintToken, state]);

  const clearSession = useCallback(() => {
    userIdRef.current = null;
    clearStoredSigningToken();
    clearRefreshTimer();
    setState({ status: "missing_user" });
  }, [clearRefreshTimer]);

  useEffect(() => {
    if (!enabled) {
      clearRefreshTimer();
      setState({ status: "idle" });
      return;
    }
    void bootstrap();
    return () => {
      clearRefreshTimer();
    };
  }, [enabled, bootstrap, clearRefreshTimer]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const userId = externalUserId?.trim();
    if (!userId) {
      setState({ status: "missing_user" });
      return;
    }
    if (userIdRef.current && userIdRef.current !== userId) {
      clearStoredSigningToken();
      void mintToken(userId);
    }
  }, [enabled, externalUserId, mintToken]);

  return {
    state,
    refresh: bootstrap,
    ensureAccessToken,
    clearSession,
  };
}
