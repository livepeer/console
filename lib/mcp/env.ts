function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function originFromHost(
  host: string | null | undefined,
  proto: string | null | undefined
): string | undefined {
  if (!host?.trim()) return undefined;
  const scheme = proto?.trim() || "https";
  return trimSlash(`${scheme}://${host.trim()}`);
}

export function mcpPublicOrigin(req?: Request): string {
  const fromEnv = process.env.MCP_PUBLIC_ORIGIN?.trim();
  if (fromEnv) return trimSlash(fromEnv);
  const appBase = process.env.APP_BASE_URL?.trim();
  if (appBase) return trimSlash(appBase);
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    return trimSlash(
      vercelProd.startsWith("http") ? vercelProd : `https://${vercelProd}`
    );
  }
  if (req) {
    const fromHeaders = originFromHost(
      req.headers.get("x-forwarded-host") || req.headers.get("host"),
      req.headers.get("x-forwarded-proto")
    );
    if (fromHeaders) return fromHeaders;
  }
  throw new Error("MCP_PUBLIC_ORIGIN (or APP_BASE_URL) is required");
}

export function mcpResourceUrl(req?: Request): string {
  return `${mcpPublicOrigin(req)}/api/mcp`;
}

export function pymthouseIssuerUrl(): string {
  const raw =
    process.env.PYMTHOUSE_ISSUER_URL?.trim() ||
    "https://pymthouse.com/api/v1/oidc";
  return trimSlash(raw);
}

export function pymthouseJwksUrl(): string {
  const raw = process.env.PYMTHOUSE_JWKS_URL?.trim();
  if (raw) return raw;
  return `${pymthouseIssuerUrl()}/jwks`;
}

export function pymthouseSignerUrl(): string {
  const raw =
    process.env.PYMTHOUSE_SIGNER_URL?.trim() ||
    "https://signer.pymthouse.com";
  const url = trimSlash(raw);
  const host = new URL(url).hostname.toLowerCase();
  if (host === "signer.daydream.live" || host.endsWith(".daydream.live")) {
    throw new Error("signer.daydream.live is refused; set PYMTHOUSE_SIGNER_URL");
  }
  return url;
}

export function discoveryServiceUrl(): string {
  return (
    process.env.DISCOVERY_SERVICE_URL?.trim() ||
    process.env.DISCOVERY_URL?.trim() ||
    "https://discovery-service-production-8955.up.railway.app/v1/discovery/raw"
  ).replace(/\/+$/, "");
}

export function discoveryOrigin(): string {
  return new URL(discoveryServiceUrl()).origin;
}

export function defaultSpendCapUsd(): number {
  const raw = process.env.DEFAULT_SPEND_CAP_USD?.trim();
  const n = raw ? Number(raw) : 25;
  return Number.isFinite(n) && n > 0 ? n : 25;
}
