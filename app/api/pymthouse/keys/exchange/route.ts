import { createApiKeyExchangeHandler } from "@pymthouse/builder-sdk/signer/server";

function readApiKeyExchangeConfig() {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  const m2mClientId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const m2mClientSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  const publicClientId =
    process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ||
    process.env.DASHBOARD_DEVICE_PUBLIC_CLIENT_ID?.trim();
  if (!issuerUrl || !m2mClientId || !m2mClientSecret || !publicClientId) {
    return null;
  }
  const issuerOrigin = issuerUrl.replace(/\/api\/v1\/oidc\/?$/, "");
  const signerUrl =
    process.env.PYMTHOUSE_SIGNER_URL?.trim() ||
    process.env.SIGNER_PUBLIC_URL?.trim() ||
    `${issuerOrigin.replace(/\/+$/, "")}/api/signer`;
  return {
    issuerUrl,
    m2mClientId,
    m2mClientSecret,
    publicClientId,
    allowInsecureHttp: process.env.PYMTHOUSE_ALLOW_INSECURE_HTTP === "1",
    signerUrl,
  };
}

export async function POST(request: Request) {
  const config = readApiKeyExchangeConfig();
  if (!config) {
    return Response.json(
      {
        error: "server_misconfigured",
        error_description:
          "PYMTHOUSE_ISSUER_URL, PYMTHOUSE_PUBLIC_CLIENT_ID, PYMTHOUSE_M2M_CLIENT_ID, and PYMTHOUSE_M2M_CLIENT_SECRET are required",
      },
      { status: 503 },
    );
  }

  const handler = createApiKeyExchangeHandler(config);
  return handler(request);
}
