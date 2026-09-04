import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import { syncCanonicalUserBestEffort } from "@/lib/identity/canonical-user";
import {
  issueAuthCode,
  parsePending,
  PKCE_COOKIE,
  pkceCookieOptions,
} from "@/lib/mcp/as";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const pending = parsePending(req.cookies.get(PKCE_COOKIE)?.value);
  const origin = req.nextUrl.origin;
  const clear = NextResponse.redirect(new URL("/", req.url), 302);
  clear.cookies.set(PKCE_COOKIE, "", { ...pkceCookieOptions(), maxAge: 0 });

  if (!pending) {
    return clear;
  }

  const session = await auth0.getSession();
  const sub = session?.user?.sub?.trim();
  if (!session || !sub) {
    const login = new URL("/auth/login", origin);
    login.searchParams.set("returnTo", "/api/mcp/oauth/callback");
    return NextResponse.redirect(login);
  }

  const externalUserId = await externalUserIdFromSub(sub);
  const email = session.user.email?.trim();
  // MCP starts Auth0 directly, bypassing the UI login's reconciliation return.
  // This must never gate the existing external-ID authorization-code flow.
  await syncCanonicalUserBestEffort({
    sub,
    email: email || undefined,
    emailVerified: session.user.email_verified === true,
  });
  let code: string;
  try {
    code = issueAuthCode({
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      clientId: pending.clientId,
      externalUserId,
      email: email || undefined,
    });
  } catch {
    return clear;
  }

  const target = new URL(pending.redirectUri);
  target.searchParams.set("code", code);
  target.searchParams.set("state", pending.clientState);
  const response = NextResponse.redirect(target.toString(), 302);
  response.cookies.set(PKCE_COOKIE, "", { ...pkceCookieOptions(), maxAge: 0 });
  return response;
}
