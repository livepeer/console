import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { enrollAuthenticatedUser } from "@/lib/access/enrollment";
import { safeIdentityReturnTo } from "@/lib/identity/sync-return";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const returnTo = safeIdentityReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  );
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login);
  }
  try {
    await enrollAuthenticatedUser(
      identity,
      await resolveProviderIdentity(identity)
    );
  } catch (error) {
    console.error("identity_sync_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
  return NextResponse.redirect(new URL(returnTo, request.url));
}
