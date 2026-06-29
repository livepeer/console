import { getSignerContext, isRunnerSignerConfigured } from "@/lib/dashboard/signer-session-bff";
import {
  callRunner,
  callRunnerStream,
  reserveSession,
  type LiveRunnerSession,
} from "@/lib/runner-gateway/call-runner";
import { stopRunnerSession } from "@/lib/runner-gateway/stop-session";
import { RunnerGatewayError } from "@/lib/runner-gateway/errors";

export type ForwardRunnerRequestInput = {
  externalUserId: string;
  appId: string;
  runnerPath: string;
  payload: Record<string, unknown>;
  discoveryUrl: string;
};

function readDiscoveryUrl(): string {
  const url = process.env.RUNNER_DISCOVERY_URL?.trim();
  if (!url) {
    throw new RunnerGatewayError(
      "RUNNER_DISCOVERY_URL is required for live-runner gateway calls",
      { code: "runner_misconfigured", status: 503 },
    );
  }
  return url;
}

function buildSignerAuth(context: Awaited<ReturnType<typeof getSignerContext>>) {
  if (!context.signerUrl) {
    return null;
  }
  return {
    signerUrl: context.signerUrl,
    jwt: context.jwt,
  };
}

export async function forwardRunnerRequest(
  input: ForwardRunnerRequestInput,
): Promise<Response> {
  const discoveryUrl = input.discoveryUrl.trim() || readDiscoveryUrl();
  let signer: ReturnType<typeof buildSignerAuth> = null;
  if (isRunnerSignerConfigured()) {
    const signerContext = await getSignerContext(input.externalUserId);
    signer = buildSignerAuth(signerContext);
  }
  const stream = Boolean(input.payload.stream);

  let session: LiveRunnerSession | null = null;
  try {
    session = await reserveSession({
      discoveryUrl,
      app: input.appId,
      signer,
    });

    const runnerUrl = `${session.appUrl.replace(/\/+$/, "")}/${input.runnerPath.replace(/^\/+/, "")}`;

    if (stream) {
      const streamResult = await callRunnerStream({
        runnerUrl,
        runner: session.runner,
        payload: input.payload,
        signer,
      });
      const headers = new Headers(streamResult.response.headers);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "text/event-stream");
      }
      return new Response(streamResult.response.body, {
        status: streamResult.response.status,
        headers,
      });
    }

    const result = await callRunner({
      runnerUrl,
      runner: session.runner,
      payload: input.payload,
      signer,
    });

    return Response.json(result.data);
  } finally {
    if (session) {
      try {
        await stopRunnerSession(session);
      } catch {
        // Release is best-effort — an unreleased session blocks capacity-1 runners.
      }
    }
  }
}

export function isRunnerGatewayConfigured(): boolean {
  return Boolean(process.env.RUNNER_DISCOVERY_URL?.trim());
}
