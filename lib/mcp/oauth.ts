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

/** GET /api/mcp identity. Codex treats a 200 here as RFC 9728 PRM, so `resource` is required. */
export function mcpIdentityBody(req: Request) {
  const origin = mcpPublicOrigin(req);
  return {
    ...prmBody(req),
    name: "Livepeer Agent MCP",
    profile: "raw",
    statement:
      "Deterministic passthrough: name a capability, pass its exact inputs, get exactly that capability.",
    transport: "streamable-http",
    mcp_url: mcpResourceUrl(req),
    docs: `${origin}/`
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
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
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

export function consoleLoginUrl(req: Request): string {
  const origin = mcpPublicOrigin(req);
  const url = new URL("/auth/login", origin);
  url.searchParams.set("returnTo", "/api/mcp/oauth/callback");
  return url.toString();
}

/** Linear trailing-slash trim. `/\/+$/` is polynomial ReDoS on attacker-controlled input. */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

export function isAllowedMcpResource(
  req: Request,
  resource: string | null | undefined
): boolean {
  const value = resource?.trim();
  if (!value) return true;
  // Clients (Claude, ChatGPT/Codex, Copilot, Hermes) may send the RFC 8707
  // resource with or without a trailing slash; treat those as the same URL.
  return stripTrailingSlashes(value) === mcpResourceUrl(req);
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
