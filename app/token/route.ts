import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, isAllowedMcpResource } from "@/lib/mcp/oauth";
import { validateAuthorizationCodeGrant } from "@/lib/mcp/token-grant";
import {
  mintMcpUserTokens,
  BillingAppMismatchError,
} from "@/lib/console/mcp-internal-mint";
import { redeemMcpRefreshToken } from "@/lib/console/mcp-oauth-login-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(req: Request, status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { ...corsHeaders(req), "Cache-Control": "no-store" },
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

/** Upstream shape only — never the whole error, whose `details` carry the raw PymtHouse body. */
function describeMintError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const { status, code } = error as { status?: number; code?: string };
  const tags = [error.name, code, status].filter(Boolean).join(" ");
  return `${tags}: ${error.message}`;
}

async function mintTokens(
  req: NextRequest,
  input: { externalUserId: string; email?: string }
) {
  try {
    const minted = await mintMcpUserTokens(input);
    return json(req, 200, {
      access_token: minted.access_token,
      refresh_token: minted.refresh_token,
      token_type: minted.token_type,
      expires_in: minted.expires_in,
      ...(minted.scope ? { scope: minted.scope } : {}),
    });
  } catch (error) {
    if (error instanceof BillingAppMismatchError) {
      return json(req, 503, {
        error: error.code,
        error_description: error.message,
      });
    }
    console.error(`mcp token mint failed — ${describeMintError(error)}`);
    return json(req, 503, {
      error: "temporarily_unavailable",
      error_description: "failed to mint an access token",
    });
  }
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
      error_description: "resource does not match this MCP",
    });
  }

  const grantType = params.get("grant_type") ?? "";

  if (grantType === "refresh_token") {
    const refreshToken = params.get("refresh_token") ?? "";
    if (!refreshToken) {
      return json(req, 400, {
        error: "invalid_request",
        error_description: "refresh_token required",
      });
    }
    const externalUserId = redeemMcpRefreshToken(refreshToken);
    if (!externalUserId) {
      return json(req, 400, { error: "invalid_grant" });
    }
    return mintTokens(req, { externalUserId });
  }

  if (grantType !== "authorization_code") {
    return json(req, 400, { error: "unsupported_grant_type" });
  }

  const outcome = validateAuthorizationCodeGrant({
    code: params.get("code")?.trim() ?? "",
    redirectUri: params.get("redirect_uri")?.trim() ?? "",
    codeVerifier: params.get("code_verifier")?.trim() ?? "",
    clientId: params.get("client_id")?.trim() ?? "",
  });
  if (!outcome.ok) {
    // A malformed request may say why; a rejected grant may not — the reason
    // would let a caller probe which half of the credential it got wrong.
    if (outcome.error === "invalid_request") {
      return json(req, 400, {
        error: outcome.error,
        error_description: outcome.reason,
      });
    }
    console.warn(`mcp token ${outcome.error} — ${outcome.reason}`);
    return json(req, 400, { error: outcome.error });
  }

  return mintTokens(req, {
    externalUserId: outcome.grant.externalUserId,
    email: outcome.grant.email,
  });
}
