import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/mcp/oauth";
import { isAllowedClientRedirectUri, normalizeRedirectUris } from "@/lib/mcp/dcr";
import { issueClientId } from "@/lib/mcp/as";

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

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  const ctype = req.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>;
    } else {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text).entries());
      const rawUris = new URLSearchParams(text).getAll("redirect_uris");
      if (rawUris.length > 0) body.redirect_uris = rawUris;
    }
  } catch {
    return json(req, 400, { error: "invalid_client_metadata" });
  }

  let redirectUris = normalizeRedirectUris(body.redirect_uris);
  if (!redirectUris && typeof body.redirect_uris === "string") {
    redirectUris = normalizeRedirectUris(
      body.redirect_uris.split(",").map((s) => s.trim())
    );
  }
  if (!redirectUris) {
    return json(req, 400, {
      error: "invalid_redirect_uri",
      error_description:
        "redirect_uris must be Claude, Cursor, or loopback (RFC 8252) URLs"
    });
  }
  if (redirectUris.some((uri) => !isAllowedClientRedirectUri(uri))) {
    return json(req, 400, { error: "invalid_redirect_uri" });
  }

  const authMethod = String(
    body.token_endpoint_auth_method ?? "none"
  ).toLowerCase();
  if (authMethod && authMethod !== "none") {
    return json(req, 400, {
      error: "invalid_client_metadata",
      error_description: "token_endpoint_auth_method must be none"
    });
  }

  let clientId: string;
  try {
    clientId = issueClientId(redirectUris);
  } catch {
    return json(req, 503, { error: "temporarily_unavailable" });
  }

  return json(req, 201, {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    code_challenge_methods: ["S256"]
  });
}
