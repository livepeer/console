import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { mcpAuth0AuthorizationParameters } from "@/lib/console/mcp-auth0-login";
import {
  decodeMcpOauthPendingCookie,
  MCP_OAUTH_COMPLETE_PATH,
  MCP_OAUTH_PENDING_COOKIE,
} from "@/lib/console/mcp-oauth-login-bridge";

export const runtime = "nodejs";

/**
 * Starts Auth0 via the official SDK (`startInteractiveLogin`).
 * MCP-only: attaches AUTH0_MCP_AUDIENCE so Universal Login can prompt consent.
 */
export async function GET(request: NextRequest) {
  const jar = await cookies();
  const pending = decodeMcpOauthPendingCookie(
    jar.get(MCP_OAUTH_PENDING_COOKIE)?.value
  );
  const origin = request.nextUrl.origin;
  if (!pending) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const connection = request.nextUrl.searchParams.get("connection")?.trim();
  const authorizationParameters = {
    ...mcpAuth0AuthorizationParameters(),
    ...(connection ? { connection } : {}),
  };

  return auth0.startInteractiveLogin({
    returnTo: MCP_OAUTH_COMPLETE_PATH,
    authorizationParameters,
  });
}
