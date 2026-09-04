import { NextRequest, NextResponse } from "next/server";

import {
  requireConsoleSession,
  SessionRequiredError,
} from "@/lib/console/session-user";
import { AccessError } from "@/lib/access/service";
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

  let session;
  try {
    session = await requireConsoleSession();
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      const login = new URL("/auth/login", origin);
      login.searchParams.set("returnTo", "/api/mcp/oauth/callback");
      return NextResponse.redirect(login);
    }
    const failure =
      error instanceof AccessError ? error : new AccessError("unavailable");
    const response = NextResponse.json(
      { error: failure.code },
      {
        status: failure.status,
        headers: { "Cache-Control": "no-store" },
      }
    );
    response.cookies.set(PKCE_COOKIE, "", {
      ...pkceCookieOptions(),
      maxAge: 0,
    });
    return response;
  }
  let code: string;
  try {
    code = issueAuthCode({
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      clientId: pending.clientId,
      externalUserId: session.externalUserId,
      email: session.email,
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
