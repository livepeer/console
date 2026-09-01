import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, isAllowedMcpResource } from "@/lib/mcp/oauth";
import { parseAuthCode, parseClientId, verifyPkceS256 } from "@/lib/mcp/as";
import { mintMcpUserTokens } from "@/lib/console/mcp-internal-mint";
import {
  redeemMcpIdentityCode,
  redeemMcpRefreshToken
} from "@/lib/console/mcp-oauth-login-bridge";

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
    } catch {
      return json(req, 400, { error: "invalid_grant" });
    }
  }

  if (grantType !== "authorization_code") {
    return json(req, 400, { error: "unsupported_grant_type" });
  }

  const code = params.get("code") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const codeVerifier = params.get("code_verifier") ?? "";
  const clientId = params.get("client_id") ?? "";
  if (!code || !redirectUri || !codeVerifier) {
    return json(req, 400, { error: "invalid_request" });
  }

  const grant = parseAuthCode(code);
  if (!grant) {
    return json(req, 400, { error: "invalid_grant" });
  }
  if (grant.redirectUri !== redirectUri) {
    return json(req, 400, { error: "invalid_grant" });
  }
  if (clientId) {
    const client = parseClientId(clientId);
    if (!client || grant.clientId !== clientId) {
      return json(req, 400, { error: "invalid_client" });
    }
  }
  if (!verifyPkceS256(codeVerifier, grant.codeChallenge)) {
    return json(req, 400, { error: "invalid_grant" });
  }

  let externalUserId = grant.externalUserId;
  let email = grant.email;
  if (!externalUserId && grant.identityCode) {
    const identity = redeemMcpIdentityCode(grant.identityCode);
    if (!identity) {
      return json(req, 400, { error: "invalid_grant" });
    }
    externalUserId = identity.externalUserId;
    email = email ?? identity.email;
  }
  if (!externalUserId) {
    return json(req, 400, { error: "invalid_grant" });
  }

  try {
    const minted = await mintMcpUserTokens({
      externalUserId,
      email
    });
    return json(req, 200, {
      access_token: minted.access_token,
      refresh_token: minted.refresh_token,
      token_type: minted.token_type ?? "Bearer",
      expires_in: minted.expires_in,
      ...(minted.scope ? { scope: minted.scope } : {})
    });
  } catch {
    return json(req, 400, { error: "invalid_grant" });
  }
}
