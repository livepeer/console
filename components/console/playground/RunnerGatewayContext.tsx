"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/console/AuthContext";
import type { App } from "@/lib/console/types";

export type RunnerGatewayState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      gatewayBaseUrl: string;
      runnerAppId: string;
      expiresIn?: number;
      /** Signer JWT minted for this session — kept in a hidden form field. */
      jwt?: string;
    }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string };

type RunnerGatewayContextValue = {
  state: RunnerGatewayState;
  canRunLive: boolean;
  signerJwt: string | undefined;
};

const RunnerGatewayContext = createContext<RunnerGatewayContextValue>({
  state: { status: "idle" },
  canRunLive: false,
  signerJwt: undefined,
});

export function useRunnerGatewayContext() {
  return useContext(RunnerGatewayContext);
}

function isLiveRunnerPlayground(model: App): boolean {
  const runnerAppId = model.runnerAppId?.trim() ?? "";
  if (!runnerAppId) return false;
  // Form-backed runners (hello-world) advertise a runnerPath; LLM runners use
  // the Language category + OpenAI chat/completions path by default.
  if (model.playgroundConfig?.runnerPath) return true;
  return model.category === "Language";
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
  const isLiveRunner = isLiveRunnerPlayground(model);

  useEffect(() => {
    if (!isLiveRunner) {
      setState({ status: "idle" });
      return;
    }

    if (!isConnected || !user?.id?.trim()) {
      setState({
        status: "unavailable",
        reason: "Sign in to run against the live runner gateway.",
      });
      return;
    }

    const externalUserId = user.id.trim();
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
          jwt?: string;
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
          jwt: data.jwt,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Failed to prepare signer session";
        setState({ status: "error", message });
      }
    })();

    return () => controller.abort();
  }, [isConnected, isLiveRunner, runnerAppId, user?.id]);

  const value = useMemo<RunnerGatewayContextValue>(() => {
    const canRunLive = state.status === "ready";
    const signerJwt = state.status === "ready" ? state.jwt : undefined;
    return { state, canRunLive, signerJwt };
  }, [state]);

  return (
    <RunnerGatewayContext.Provider value={value}>{children}</RunnerGatewayContext.Provider>
  );
}
