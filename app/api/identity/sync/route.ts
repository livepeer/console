import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { syncCanonicalUserBestEffort } from "@/lib/identity/canonical-user";
import { safeIdentityReturnTo } from "@/lib/identity/sync-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const returnTo = safeIdentityReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  );
  const session = await auth0.getSession();
  const user = session?.user;
  const sub = user?.sub?.trim();

  if (!user || !sub) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login);
  }

  await syncCanonicalUserBestEffort({
    sub,
    email: user.email?.trim() || undefined,
    emailVerified: user.email_verified === true,
  });
  return NextResponse.redirect(new URL(returnTo, request.url));
}
