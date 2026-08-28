import { RunnerGatewayError } from "@/lib/runner-gateway/errors";
import type { LiveRunnerSession } from "@/lib/runner-gateway/call-runner";

function joinEndpoint(base: string, suffix: string): string {
  const trimmed = base.replace(/\/+$/, "");
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${trimmed}${path}`;
}

export async function stopRunnerSession(
  session: LiveRunnerSession,
  options?: { timeoutMs?: number }
): Promise<void> {
  const runnerUrl = session.runnerUrl.trim();
  const sessionId = session.sessionId.trim();
  if (!runnerUrl) {
    throw new RunnerGatewayError(
      "Live runner session stop requires runner_url",
      {
        code: "runner_error",
        status: 400,
      }
    );
  }
  if (!sessionId) {
    throw new RunnerGatewayError(
      "Live runner session stop requires session_id",
      {
        code: "runner_error",
        status: 400,
      }
    );
  }

  const encoded = encodeURIComponent(sessionId);
  const url = joinEndpoint(runnerUrl, `/${encoded}/stop`);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 10_000
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new RunnerGatewayError(
        `Failed to stop runner session: HTTP ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        { code: "runner_error", status: 502 }
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
