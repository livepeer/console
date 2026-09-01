import { mcpPublicOrigin, mcpResourceUrl } from "./env";

export function prmBody(req: Request) {
  const origin = mcpPublicOrigin(req);
  const resource = mcpResourceUrl(req);
  return {
    resource,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "sign:job"
    ],
    resource_documentation: `${origin}/`
  };
}

export function asMetadata(req: Request) {
  const origin = mcpPublicOrigin(req);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "sign:job"
    ]
  };
}

export function wwwAuthenticate(req: Request): string {
  const meta = `${mcpPublicOrigin(req)}/.well-known/oauth-protected-resource/api/mcp`;
  return `Bearer realm="livepeer-mcp", resource_metadata="${meta}"`;
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400"
  };
}

export function consoleLoginUrl(req: Request, nonce: string): string {
  const origin = mcpPublicOrigin(req);
  const callback = `${origin}/api/mcp/oauth/callback`;
  const url = new URL("/login", origin);
  url.searchParams.set("mcp_oauth", "1");
  url.searchParams.set("state", nonce);
  url.searchParams.set("redirect_uri", callback);
  return url.toString();
}

export function isAllowedMcpResource(
  req: Request,
  resource: string | null | undefined
): boolean {
  const value = resource?.trim();
  if (!value) return true;
  return value.replace(/\/+$/, "") === mcpResourceUrl(req);
}

export function wellKnownJsonResponse(
  req: Request,
  body: unknown
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60"
    }
  });
}

export function wellKnownOptionsResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
