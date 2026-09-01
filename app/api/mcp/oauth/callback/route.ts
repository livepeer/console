import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import {
  issueAuthCode,
  parsePending,
  PKCE_COOKIE,
  pkceCookieOptions
} from "@/lib/mcp/as";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state")?.trim() ?? "";
  const origin = req.nextUrl.origin;

  const pending = parsePending(req.cookies.get(PKCE_COOKIE)?.value);
  const clear = NextResponse.redirect(new URL("/", req.url), 302);
  clear.cookies.set(PKCE_COOKIE, "", { ...pkceCookieOptions(), maxAge: 0 });

  if (!pending || pending.nonce !== state) {
    return clear;
  }

  // The subject is whoever holds the Console session. Query parameters carry no
  // identity here — this endpoint is reachable without signing in.
  const session = await auth0.getSession();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    const callback = `${origin}/api/mcp/oauth/callback`;
    return NextResponse.redirect(
      new URL(
        `/login?mcp_oauth=1&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(callback)}`,
        origin
      )
    );
  }

  const externalUserId = await externalUserIdFromSub(sub);
  const email = session?.user?.email?.trim() || undefined;

  let code: string;
  try {
    code = issueAuthCode({
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      clientId: pending.clientId,
      externalUserId,
      email
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
