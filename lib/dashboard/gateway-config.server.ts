import "server-only";

import {
  readGatewayConfigFromEnv,
  type GatewayServerConfig,
} from "@pymthouse/builder-sdk/gateway/server";

export type { GatewayServerConfig };

function issuerOriginFromIssuerUrl(issuerUrl: string): string {
  let base = issuerUrl.trim().replace(/\/+$/, "");
  if (base.endsWith("/api/v1/oidc")) {
    base = base.slice(0, -"/api/v1/oidc".length);
  } else if (base.endsWith("/oidc")) {
    base = base.slice(0, -"/oidc".length);
  }
  return base.replace(/\/+$/, "");
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

function requestOriginFromRequest(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : new URL(request.url).protocol.replace(":", "");
    return `${protocol}://${host}`;
  }
  return new URL(request.url).origin;
}

export function resolveDashboardSignerUpstreamUrl(): string | null {
  const env = process.env;
  const issuerUrl = env.PYMTHOUSE_ISSUER_URL?.trim();
  const signerUrl =
    env.PYMTHOUSE_SIGNER_URL?.trim() ||
    env.SIGNER_PUBLIC_URL?.trim() ||
    env.GATEWAY_SIGNER_UPSTREAM_URL?.trim() ||
    (issuerUrl ? `${issuerOriginFromIssuerUrl(issuerUrl)}/api/signer` : "");
  return signerUrl || null;
}

function resolveDashboardGatewaySignerUrl(request?: Request): string | null {
  if (process.env.GATEWAY_SIGNER_FROM_REQUEST_ORIGIN === "1" && request) {
    return `${stripTrailingSlashes(requestOriginFromRequest(request))}/api/signer`;
  }
  return resolveDashboardSignerUpstreamUrl();
}

/** Per-request gateway config (signer URL matches dashboard host:port when enabled). */
export function readDashboardGatewayConfig(request?: Request): GatewayServerConfig | null {
  const base = readGatewayConfigFromEnv(process.env);
  if (!base) {
    return null;
  }
  const signerUrl = resolveDashboardGatewaySignerUrl(request);
  if (!signerUrl) {
    return null;
  }
  return { ...base, signerUrl };
}
