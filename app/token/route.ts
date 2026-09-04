import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, isAllowedMcpResource } from "@/lib/mcp/oauth";
import { parseAuthCode, verifyPkceS256 } from "@/lib/mcp/as";
import { isKnownClientId } from "@/lib/mcp/cimd";
import { redirectUrisMatch } from "@/lib/mcp/dcr";
import { mintMcpUserTokens, BillingAppMismatchError } from "@/lib/console/mcp-internal-mint";
import { redeemMcpRefreshToken } from "@/lib/console/mcp-oauth-login-bridge";

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

async function readParams(req: NextRequest): Promise<URLSearchParams> {
  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const parsed = (await req.json()) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(parsed)) {
      if (v == null) continue;
      params.set(k, String(v));
    }
    return params;
  }
  return new URLSearchParams(await req.text());
}

export async function POST(req: NextRequest) {
  let params: URLSearchParams;
  try {
    params = await readParams(req);
  } catch {
    return json(req, 400, { error: "invalid_request" });
  }

  if (!isAllowedMcpResource(req, params.get("resource"))) {
    return json(req, 400, {
      error: "invalid_target",
      error_description: "resource does not match this MCP"
    });
  }

  const grantType = params.get("grant_type") ?? "";
  if (grantType === "refresh_token") {
    const refreshToken = params.get("refresh_token") ?? "";
    if (!refreshToken) {
      return json(req, 400, {
        error: "invalid_request",
        error_description: "refresh_token required"
      });
    }
    const eu = redeemMcpRefreshToken(refreshToken);
    if (!eu) {
      return json(req, 400, { error: "invalid_grant" });
    }
    try {
      const minted = await mintMcpUserTokens({ externalUserId: eu });
      return json(req, 200, {
        access_token: minted.access_token,
        refresh_token: minted.refresh_token,
        token_type: minted.token_type ?? "Bearer",
        expires_in: minted.expires_in,
        ...(minted.scope ? { scope: minted.scope } : {})
      });
    } catch (error) {
      if (error instanceof BillingAppMismatchError) {
        return json(req, 503, {
          error: error.code,
          error_description: error.message
        });
      }
      return json(req, 400, { error: "invalid_grant" });
    }
  }

  if (grantType !== "authorization_code") {
    return json(req, 400, { error: "unsupported_grant_type" });
  }

  const code = params.get("code")?.trim() ?? "";
  const redirectUri = params.get("redirect_uri")?.trim() ?? "";
  const codeVerifier = params.get("code_verifier")?.trim() ?? "";
  const clientId = params.get("client_id")?.trim() ?? "";
  if (!code || !redirectUri || !codeVerifier) {
    return json(req, 400, {
      error: "invalid_request",
      error_description: "code, redirect_uri, and code_verifier are required"
    });
  }

  const grant = parseAuthCode(code);
  if (!grant) {
    return json(req, 400, {
      error: "invalid_grant",
      error_description: "authorization code is invalid or expired"
    });
  }
  if (!redirectUrisMatch(grant.redirectUri, redirectUri)) {
    return json(req, 400, {
      error: "invalid_grant",
      error_description: "redirect_uri does not match authorization request"
    });
  }
  if (clientId) {
    if (grant.clientId !== clientId || !isKnownClientId(clientId)) {
      return json(req, 400, {
        error: "invalid_client",
        error_description: "client_id does not match authorization request"
      });
    }
  }
  if (!verifyPkceS256(codeVerifier, grant.codeChallenge)) {
    return json(req, 400, {
      error: "invalid_grant",
      error_description: "PKCE verification failed"
    });
  }

  if (!grant.externalUserId) {
    return json(req, 400, {
      error: "invalid_grant",
      error_description: "authorization code is missing the end-user"
    });
  }

  try {
    const minted = await mintMcpUserTokens({
      externalUserId: grant.externalUserId,
      email: grant.email
    });
    return json(req, 200, {
      access_token: minted.access_token,
      refresh_token: minted.refresh_token,
      token_type: minted.token_type ?? "Bearer",
      expires_in: minted.expires_in,
      ...(minted.scope ? { scope: minted.scope } : {})
    });
  } catch (error) {
    if (error instanceof BillingAppMismatchError) {
      return json(req, 503, {
        error: error.code,
        error_description: error.message
      });
    }
    console.error("mcp token mint failed", error);
    return json(req, 503, {
      error: "temporarily_unavailable",
      error_description: "failed to mint access token"
    });
  }
}
