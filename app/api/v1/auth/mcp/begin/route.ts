import { NextRequest, NextResponse } from "next/server";

import {
  encodeMcpOauthPendingCookie,
  MCP_OAUTH_PENDING_COOKIE,
  parseMcpOauthLoginQuery,
} from "@/lib/console/mcp-oauth-login-bridge";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const parsed = parseMcpOauthLoginQuery({
    mcpOauth: "1",
    state: request.nextUrl.searchParams.get("state") ?? undefined,
    redirectUri: request.nextUrl.searchParams.get("redirect_uri") ?? undefined,
  });
  const origin = request.nextUrl.origin;
  if (!parsed.ok) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const response = NextResponse.redirect(new URL("/login?mcp_bridge=1", origin));
  response.cookies.set(
    MCP_OAUTH_PENDING_COOKIE,
    encodeMcpOauthPendingCookie(parsed.pending),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    }
  );
  return response;
}
