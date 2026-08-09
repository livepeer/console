import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  normalizeDeviceExchangeResponse,
  parseApiKeyExchangeRequestBody,
} from "@pymthouse/builder-sdk/signer/server";

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

type ExchangeConfig = {
  issuerUrl: string;
  publicClientId: string;
  m2mClientId: string;
  m2mClientSecret: string;
  signerUrl: string | undefined;
};

/** Thin BFF; canonical issuer route is POST …/apps/{clientId}/oidc/token (RFC 8693). */
function readApiKeyExchangeConfig(): ExchangeConfig | null {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  const publicClientId =
    process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ||
    process.env.DASHBOARD_DEVICE_PUBLIC_CLIENT_ID?.trim();
  if (!issuerUrl || !publicClientId) {
    return null;
  }
  const signerUrl =
    process.env.PYMTHOUSE_CLIENT_SIGNER_API_URL?.trim() ||
    process.env.PYMTHOUSE_SIGNER_URL?.trim() ||
    process.env.SIGNER_PUBLIC_URL?.trim() ||
    undefined;
  return {
    issuerUrl,
    publicClientId,
    m2mClientId: process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim() ?? "",
    m2mClientSecret: process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim() ?? "",
    signerUrl,
  };
}

function appsOrigin(issuerUrl: string): string {
  return issuerUrl.replace(/\/api\/v1\/oidc\/?$/i, "");
}

function readStringField(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function exchangeApiKeyViaOidcToken(input: {
  config: ExchangeConfig;
  apiKey: string;
  scope?: string;
}): Promise<Response> {
  const { config, apiKey, scope } = input;
  const url = `${appsOrigin(config.issuerUrl)}/api/v1/apps/${encodeURIComponent(config.publicClientId)}/oidc/token`;

  const form = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT,
    subject_token: apiKey,
    subject_token_type: ACCESS_TOKEN_TYPE,
  });
  if (scope) {
    form.set("scope", scope);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (config.m2mClientId && config.m2mClientSecret) {
    const basic = Buffer.from(
      [config.m2mClientId, config.m2mClientSecret].join(":"),
    ).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: form.toString(),
    cache: "no-store",
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new PmtHouseError("Token exchange returned invalid JSON", {
      status: 502,
      code: "invalid_exchange_response",
    });
  }

  if (!response.ok) {
    const description =
      readStringField(parsed, "error_description") ||
      readStringField(parsed, "error") ||
      `Token exchange failed (${response.status})`;
    throw new PmtHouseError(description, {
      status: response.status,
      code: readStringField(parsed, "error") ?? "api_key_exchange_failed",
    });
  }

  const accessToken = readStringField(parsed, "access_token");
  if (!accessToken) {
    throw new PmtHouseError("Token exchange response missing access_token", {
      status: 502,
      code: "invalid_exchange_response",
    });
  }

  const signerUrl =
    readStringField(parsed, "signer_url") || config.signerUrl || undefined;

  const expiresIn =
    typeof parsed.expires_in === "number" && Number.isFinite(parsed.expires_in)
      ? parsed.expires_in
      : 3600;

  const body = normalizeDeviceExchangeResponse(
    {
      access_token: accessToken,
      expires_in: expiresIn,
      scope: readStringField(parsed, "scope") || scope || "sign:job",
      balanceUsdMicros: readStringField(parsed, "balanceUsdMicros") ?? "0",
      lifetimeGrantedUsdMicros:
        readStringField(parsed, "lifetimeGrantedUsdMicros") ?? "0",
    },
    { signer_url: signerUrl },
  );

  return Response.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof PmtHouseError) {
    return Response.json(
      {
        error: error.code ?? "api_key_exchange_failed",
        error_description: error.message,
      },
      { status: error.status ?? 500 },
    );
  }
  const message = error instanceof Error ? error.message : "API key exchange failed";
  return Response.json(
    { error: "api_key_exchange_failed", error_description: message },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const config = readApiKeyExchangeConfig();
  if (!config) {
    return Response.json(
      {
        error: "server_misconfigured",
        error_description:
          "PYMTHOUSE_ISSUER_URL and PYMTHOUSE_PUBLIC_CLIENT_ID are required",
      },
      { status: 503 },
    );
  }

  try {
    const parsed = await parseApiKeyExchangeRequestBody(request);
    const effectiveClientId = parsed.clientId?.trim() || config.publicClientId;
    if (effectiveClientId !== config.publicClientId) {
      throw new PmtHouseError("clientId does not match configured public client", {
        status: 400,
        code: "invalid_request",
      });
    }
    return await exchangeApiKeyViaOidcToken({
      config,
      apiKey: parsed.apiKey,
      scope: parsed.scope,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
