import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import {
  buildMcpOauthCallbackUrl,
  decodeMcpOauthPendingCookie,
  isFirstPartyMcpCallback,
  issueMcpIdentityCode,
  MCP_OAUTH_PENDING_COOKIE
} from "@/lib/console/mcp-oauth-login-bridge";
import {
  issueAuthCode,
  parsePending,
  PKCE_COOKIE,
  pkceCookieOptions
} from "@/lib/mcp/as";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const origin = request.nextUrl.origin;
  const pending = decodeMcpOauthPendingCookie(
    jar.get(MCP_OAUTH_PENDING_COOKIE)?.value,
    origin
  );
  jar.delete(MCP_OAUTH_PENDING_COOKIE);

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

  if (isFirstPartyMcpCallback(pending.redirectUri, origin)) {
    const pkce = parsePending(jar.get(PKCE_COOKIE)?.value);
    if (!pkce || pkce.nonce !== pending.state) {
      return NextResponse.redirect(new URL("/login", origin));
    }
    let code: string;
    try {
      code = issueAuthCode({
        redirectUri: pkce.redirectUri,
        codeChallenge: pkce.codeChallenge,
        clientId: pkce.clientId,
        externalUserId,
        email: email || undefined
      });
    } catch {
      return NextResponse.redirect(new URL("/login", origin));
    }
    const target = new URL(pkce.redirectUri);
    target.searchParams.set("code", code);
    target.searchParams.set("state", pkce.clientState);
    const response = NextResponse.redirect(target.toString(), 302);
    response.cookies.set(PKCE_COOKIE, "", { ...pkceCookieOptions(), maxAge: 0 });
    return response;
  }

  const code = issueMcpIdentityCode({
    externalUserId,
    email: email || undefined,
    state: pending.state
  });
  const target = buildMcpOauthCallbackUrl({
    redirectUri: pending.redirectUri,
    state: pending.state,
    externalUserId,
    email: email || undefined,
    code
  });
  return NextResponse.redirect(target);
}
