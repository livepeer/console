import { createApiKeyExchangeHandler } from "@pymthouse/builder-sdk/signer/server";

/** Thin BFF pass-through; canonical issuer route is POST …/auth/api-key/signer-session. */
function readApiKeyExchangeConfig() {
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
    // builder-sdk 0.5.0 exchanges via issuer …/auth/api-key/signer-session (no M2M).
    m2mClientId: process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim() ?? "",
    m2mClientSecret: process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim() ?? "",
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
          "PYMTHOUSE_ISSUER_URL and PYMTHOUSE_PUBLIC_CLIENT_ID are required",
      },
      { status: 503 },
    );
  }

  const handler = createApiKeyExchangeHandler(config);
  return handler(request);
}
