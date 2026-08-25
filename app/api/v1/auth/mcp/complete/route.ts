import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import {
  buildMcpOauthCallbackUrl,
  decodeMcpOauthPendingCookie,
  MCP_OAUTH_PENDING_COOKIE,
} from "@/lib/console/mcp-oauth-login-bridge";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const pending = decodeMcpOauthPendingCookie(
    jar.get(MCP_OAUTH_PENDING_COOKIE)?.value
  );
  jar.delete(MCP_OAUTH_PENDING_COOKIE);
  const origin = request.nextUrl.origin;

  if (!pending) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const session = await auth0.getSession();
  const sub = session?.user?.sub?.trim();
  if (!session || !sub) {
    return NextResponse.redirect(
      new URL(
        `/login?mcp_oauth=1&state=${encodeURIComponent(pending.state)}&redirect_uri=${encodeURIComponent(pending.redirectUri)}`,
        origin
      )
    );
  }

  const externalUserId = await externalUserIdFromSub(sub);
  const email = session.user.email?.trim();
  const target = buildMcpOauthCallbackUrl({
    redirectUri: pending.redirectUri,
    state: pending.state,
    externalUserId,
    email: email || undefined,
  });
  return NextResponse.redirect(target);
}
