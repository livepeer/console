import { createDeviceExchangeHandler } from "@pymthouse/builder-sdk/signer/server";

function readDeviceExchangeConfig() {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  const m2mClientId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const m2mClientSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  if (!issuerUrl || !m2mClientId || !m2mClientSecret) {
    return null;
  }
  const signerUrl =
    process.env.PYMTHOUSE_SIGNER_URL?.trim() ||
    process.env.SIGNER_PUBLIC_URL?.trim() ||
    undefined;
  return {
    issuerUrl,
    m2mClientId,
    m2mClientSecret,
    allowInsecureHttp: process.env.PYMTHOUSE_ALLOW_INSECURE_HTTP === "1",
    signerUrl,
  };
}

export async function POST(request: Request) {
  const config = readDeviceExchangeConfig();
  if (!config) {
    return Response.json(
      {
        error: "server_misconfigured",
        error_description:
          "PYMTHOUSE_ISSUER_URL, PYMTHOUSE_M2M_CLIENT_ID, and PYMTHOUSE_M2M_CLIENT_SECRET are required",
      },
      { status: 503 },
    );
  }

  const handler = createDeviceExchangeHandler(config);
  return handler(request);
}
