import {
  DIRECT_SIGNER_PATHS,
  signerEndpointUrl,
} from "@pymthouse/builder-sdk/signer/server";
import {
  NoRunnerAvailableError,
  RunnerGatewayError,
  RunnerHttpError,
} from "@/lib/runner-gateway/errors";
import type { LiveRunnerInstance } from "@/lib/runner-gateway/discovery";

export type LiveRunnerSession = {
  sessionId: string;
  appUrl: string;
  runnerUrl: string;
  runner: LiveRunnerInstance | null;
};

export type LiveRunnerCallResult = {
  data: Record<string, unknown>;
  runnerUrl: string;
  runner: LiveRunnerInstance | null;
  sessionId: string;
};

export type LiveRunnerStreamResult = {
  response: Response;
  runnerUrl: string;
  runner: LiveRunnerInstance | null;
  sessionId: string;
};

type RunnerPaymentChallenge = {
  paymentParams: string;
  orchestratorUrl: string;
  manifestId: string;
};

type SignerAuth = {
  signerUrl: string;
  jwt: string;
};

const PAYER_ADDRESS_HEADER = "Livepeer-Payer-Address";

async function getSignerAddress(signer: SignerAuth): Promise<string> {
  const url = signerEndpointUrl(signer.signerUrl, DIRECT_SIGNER_PATHS.signOrchestratorInfo);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signer.jwt}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new RunnerGatewayError(
      `Signer info failed: HTTP ${response.status}${text ? ` — ${text.slice(0, 200)}` : ""}`,
      { code: "signer_error", status: 502 },
    );
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new RunnerGatewayError("Signer info response was not valid JSON", {
      code: "signer_error",
      status: 502,
    });
  }
  const address = typeof data.address === "string" ? data.address.trim() : "";
  if (!address) {
    throw new RunnerGatewayError("Signer info response missing address", {
      code: "signer_error",
      status: 502,
    });
  }
  return address;
}

function parseRunnerPaymentChallenge(error: RunnerHttpError): RunnerPaymentChallenge {
  let data: unknown;
  try {
    data = JSON.parse(error.body);
  } catch {
    throw new RunnerGatewayError("Live runner payment challenge response was not valid JSON", {
      code: "payment_challenge_invalid",
      status: 502,
    });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new RunnerGatewayError("Live runner payment challenge response must be a JSON object", {
      code: "payment_challenge_invalid",
      status: 502,
    });
  }
  const record = data as Record<string, unknown>;
  const paymentParams =
    typeof record.payment_params === "string" ? record.payment_params : "";
  const orchestratorUrl = typeof record.orchestrator === "string" ? record.orchestrator : "";
  const manifestId = typeof record.manifest_id === "string" ? record.manifest_id : "";
  if (!paymentParams || !orchestratorUrl || !manifestId) {
    throw new RunnerGatewayError("Live runner payment challenge missing required fields", {
      code: "payment_challenge_invalid",
      status: 502,
    });
  }
  return { paymentParams, orchestratorUrl, manifestId };
}

async function getRunnerPayment(
  challenge: RunnerPaymentChallenge,
  signer: SignerAuth,
): Promise<{ payment: string; segCreds: string }> {
  const url = signerEndpointUrl(signer.signerUrl, DIRECT_SIGNER_PATHS.generateLivePayment);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signer.jwt}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orchestrator: challenge.paymentParams,
      type: "lv2v",
      ManifestID: challenge.manifestId,
    }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new RunnerGatewayError(
      `Payment mint failed: HTTP ${response.status}${text ? ` — ${text.slice(0, 200)}` : ""}`,
      { code: "signer_error", status: 502 },
    );
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new RunnerGatewayError("Payment response was not valid JSON", {
      code: "signer_error",
      status: 502,
    });
  }
  const payment = typeof data.payment === "string" ? data.payment : "";
  const segCreds =
    typeof data.segCreds === "string"
      ? data.segCreds
      : typeof data.seg_creds === "string"
        ? data.seg_creds
        : "";
  if (!payment || !segCreds) {
    throw new RunnerGatewayError("Payment response missing payment or segCreds", {
      code: "signer_error",
      status: 502,
    });
  }
  return { payment, segCreds };
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!response.ok) {
    throw new RunnerHttpError(response.status, text);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new RunnerGatewayError("Live runner call expected JSON object", {
      code: "runner_error",
      status: 502,
    });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new RunnerGatewayError(
      `Live runner call expected JSON object, got ${Array.isArray(data) ? "array" : typeof data}`,
      { code: "runner_error", status: 502 },
    );
  }
  return data as Record<string, unknown>;
}

export async function callRunner(input: {
  runnerUrl: string;
  runner?: LiveRunnerInstance | null;
  payload?: Record<string, unknown>;
  method?: string;
  signer?: SignerAuth | null;
  timeoutMs?: number;
  maxPaymentChallengeRetries?: number;
}): Promise<LiveRunnerCallResult> {
  const runnerUrl = input.runnerUrl.trim();
  if (!runnerUrl) {
    throw new RunnerGatewayError("Live runner call requires runner_url", {
      code: "runner_error",
      status: 400,
    });
  }

  const requestPayload = input.payload ?? {};
  const method = (input.method ?? "POST").toUpperCase();
  const signer = input.signer ?? null;
  const maxRetries = input.maxPaymentChallengeRetries ?? 3;
  const attempts = (Math.max(0, maxRetries) + 1) * 2;

  let payerAddress = "";
  if (signer) {
    payerAddress = await getSignerAddress(signer);
  }

  let challenge: RunnerPaymentChallenge | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    let sessionId = "";

    if (signer) {
      headers[PAYER_ADDRESS_HEADER] = payerAddress;
    }

    if (challenge && signer) {
      const payment = await getRunnerPayment(challenge, signer);
      headers["Livepeer-Payment"] = payment.payment;
      headers["Livepeer-Segment"] = payment.segCreds;
      sessionId = challenge.manifestId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 120_000);

    try {
      const response = await fetch(runnerUrl, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(requestPayload),
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 402) {
        if (!signer) {
          throw new RunnerGatewayError("Live runner paid call requires signer", {
            code: "signer_misconfigured",
            status: 503,
          });
        }
        const body = await response.text();
        challenge = parseRunnerPaymentChallenge(new RunnerHttpError(402, body));
        continue;
      }

      const data = await readJsonResponse(response);
      const dataSessionId =
        typeof data.session_id === "string" ? data.session_id.trim() : "";
      return {
        data,
        runnerUrl,
        runner: input.runner ?? null,
        sessionId: sessionId || dataSessionId,
      };
    } catch (error) {
      if (error instanceof RunnerHttpError && error.statusCode === 402 && signer) {
        challenge = parseRunnerPaymentChallenge(error);
        continue;
      }
      if (error instanceof RunnerGatewayError) throw error;
      if (error instanceof RunnerHttpError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new RunnerGatewayError("Live runner call timed out", {
          code: "runner_timeout",
          status: 504,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new RunnerGatewayError("Live runner call exhausted payment challenge retries", {
    code: "payment_challenge_exhausted",
    status: 502,
  });
}

export async function callRunnerStream(input: {
  runnerUrl: string;
  runner?: LiveRunnerInstance | null;
  payload?: Record<string, unknown>;
  method?: string;
  signer?: SignerAuth | null;
  timeoutMs?: number;
  maxPaymentChallengeRetries?: number;
}): Promise<LiveRunnerStreamResult> {
  const runnerUrl = input.runnerUrl.trim();
  if (!runnerUrl) {
    throw new RunnerGatewayError("Live runner call requires runner_url", {
      code: "runner_error",
      status: 400,
    });
  }

  const requestPayload = input.payload ?? {};
  const method = (input.method ?? "POST").toUpperCase();
  const signer = input.signer ?? null;
  const maxRetries = input.maxPaymentChallengeRetries ?? 3;
  const attempts = (Math.max(0, maxRetries) + 1) * 2;

  let payerAddress = "";
  if (signer) {
    payerAddress = await getSignerAddress(signer);
  }

  let challenge: RunnerPaymentChallenge | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const headers: Record<string, string> = {
      Accept: "text/event-stream, application/json",
      "Content-Type": "application/json",
    };
    let sessionId = "";

    if (signer) {
      headers[PAYER_ADDRESS_HEADER] = payerAddress;
    }

    if (challenge && signer) {
      const payment = await getRunnerPayment(challenge, signer);
      headers["Livepeer-Payment"] = payment.payment;
      headers["Livepeer-Segment"] = payment.segCreds;
      sessionId = challenge.manifestId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 300_000);

    try {
      const response = await fetch(runnerUrl, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(requestPayload),
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 402) {
        if (!signer) {
          throw new RunnerGatewayError("Live runner paid call requires signer", {
            code: "signer_misconfigured",
            status: 503,
          });
        }
        const body = await response.text();
        challenge = parseRunnerPaymentChallenge(new RunnerHttpError(402, body));
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new RunnerHttpError(response.status, body);
      }

      return {
        response,
        runnerUrl,
        runner: input.runner ?? null,
        sessionId,
      };
    } catch (error) {
      if (error instanceof RunnerHttpError && error.statusCode === 402 && signer) {
        challenge = parseRunnerPaymentChallenge(error);
        continue;
      }
      if (error instanceof RunnerGatewayError) throw error;
      if (error instanceof RunnerHttpError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new RunnerGatewayError("Live runner stream call timed out", {
          code: "runner_timeout",
          status: 504,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new RunnerGatewayError("Live runner stream call exhausted payment challenge retries", {
    code: "payment_challenge_exhausted",
    status: 502,
  });
}

export async function reserveSession(input: {
  discoveryUrl: string;
  app: string;
  signer?: SignerAuth | null;
  timeoutMs?: number;
}): Promise<LiveRunnerSession> {
  const { discoverRunnerCandidates } = await import("@/lib/runner-gateway/discovery");
  const candidates = await discoverRunnerCandidates({
    discoveryUrl: input.discoveryUrl,
    app: input.app,
  });

  if (candidates.length === 0) {
    throw new NoRunnerAvailableError();
  }

  let lastError: unknown;
  for (const runner of candidates) {
    try {
      const result = await callRunner({
        runnerUrl: runner.url,
        runner,
        payload: {},
        signer: input.signer,
        timeoutMs: input.timeoutMs ?? 30_000,
      });
      const sessionId =
        typeof result.data.session_id === "string" ? result.data.session_id.trim() : "";
      const appUrl =
        typeof result.data.app_url === "string" ? result.data.app_url.trim() : "";
      if (!sessionId) {
        throw new RunnerGatewayError("runner session response missing session_id", {
          code: "runner_error",
          status: 502,
        });
      }
      if (!appUrl) {
        throw new RunnerGatewayError("runner session response missing app_url", {
          code: "runner_error",
          status: 502,
        });
      }
      return {
        sessionId,
        appUrl,
        runnerUrl: result.runnerUrl,
        runner,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new NoRunnerAvailableError();
}
