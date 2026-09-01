import { NextRequest, NextResponse } from "next/server";
import { consoleLoginUrl, corsHeaders, isAllowedMcpResource } from "@/lib/mcp/oauth";
import {
  issuePending,
  newNonce,
  parseClientId,
  PKCE_COOKIE,
  pkceCookieOptions
} from "@/lib/mcp/as";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(req: Request, status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { ...corsHeaders(req), "Cache-Control": "no-store" }
  });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const clientState = url.searchParams.get("state") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const method = (url.searchParams.get("code_challenge_method") ?? "").trim();
  const responseType = url.searchParams.get("response_type") ?? "code";
  const clientId = url.searchParams.get("client_id") ?? "";
  const resource = url.searchParams.get("resource");

  if (responseType !== "code") {
    return json(req, 400, { error: "unsupported_response_type" });
  }
  if (method && method.toUpperCase() !== "S256") {
    return json(req, 400, {
      error: "invalid_request",
      error_description: "code_challenge_method must be S256"
    });
  }
  if (!codeChallenge || codeChallenge.length < 16) {
    return json(req, 400, {
      error: "invalid_request",
      error_description: "code_challenge required"
    });
  }
  if (!clientState) {
    return json(req, 400, {
      error: "invalid_request",
      error_description: "state required"
    });
  }
  if (!isAllowedMcpResource(req, resource)) {
    return json(req, 400, {
      error: "invalid_target",
      error_description: "resource does not match this MCP"
    });
  }

  const client = parseClientId(clientId);
  if (!client) {
    return json(req, 400, {
      error: "invalid_client",
      error_description: "unknown client_id — register first"
    });
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return json(req, 400, {
      error: "invalid_request",
      error_description: "redirect_uri does not match client registration"
    });
  }

  const nonce = newNonce();
  let pending: string;
  try {
    pending = issuePending({
      nonce,
      clientId,
      clientState,
      redirectUri,
      codeChallenge
    });
  } catch {
    return json(req, 503, { error: "temporarily_unavailable" });
  }

  const login = consoleLoginUrl(req, nonce);
  const response = NextResponse.redirect(login, 302);
  response.cookies.set(PKCE_COOKIE, pending, pkceCookieOptions());
  for (const [k, v] of Object.entries(corsHeaders(req))) {
    response.headers.set(k, v);
  }
  return response;
}
