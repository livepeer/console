"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/dashboard/AuthContext";
import type { App } from "@/lib/dashboard/types";

export type RunnerGatewayState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; gatewayBaseUrl: string; runnerAppId: string; expiresIn?: number }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string };

type RunnerGatewayContextValue = {
  state: RunnerGatewayState;
  canRunLive: boolean;
};

const RunnerGatewayContext = createContext<RunnerGatewayContextValue>({
  state: { status: "idle" },
  canRunLive: false,
});

export function useRunnerGatewayContext() {
  return useContext(RunnerGatewayContext);
}

export function RunnerGatewayProvider({
  model,
  children,
}: {
  model: App;
  children: ReactNode;
}) {
  const { isConnected, user } = useAuth();
  const [state, setState] = useState<RunnerGatewayState>({ status: "idle" });

  const runnerAppId = model.runnerAppId?.trim() ?? "";
  const isRunnerLlm = model.category === "Language" && Boolean(runnerAppId);

  useEffect(() => {
    if (!isRunnerLlm) {
      setState({ status: "idle" });
      return;
    }

    if (!isConnected || !user?.email?.trim()) {
      setState({
        status: "unavailable",
        reason: "Sign in to run against the live runner gateway.",
      });
      return;
    }

    const externalUserId = user.email.trim();
    const controller = new AbortController();
    setState({ status: "loading" });

    void (async () => {
      try {
        const response = await fetch("/api/pymthouse/signer-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalUserId }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          ready?: boolean;
          expiresIn?: number;
          error?: string;
          error_description?: string;
        };

        if (!response.ok) {
          const message =
            data.error_description ?? data.error ?? "Signer session unavailable";
          setState({ status: "unavailable", reason: message });
          return;
        }

        setState({
          status: "ready",
          gatewayBaseUrl: "/api/runner-gateway/v1",
          runnerAppId,
          expiresIn: data.expiresIn,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Failed to prepare signer session";
        setState({ status: "error", message });
      }
    })();

    return () => controller.abort();
  }, [isConnected, isRunnerLlm, runnerAppId, user?.email]);

  const value = useMemo<RunnerGatewayContextValue>(() => {
    const canRunLive = state.status === "ready";
    return { state, canRunLive };
  }, [state]);

  return (
    <RunnerGatewayContext.Provider value={value}>{children}</RunnerGatewayContext.Provider>
  );
}
