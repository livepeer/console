import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { enrollAuthenticatedUser } from "@/lib/access/enrollment";
import { safeIdentityReturnTo } from "@/lib/identity/sync-return";
import { getAccessDecision } from "@/lib/access/service";
import { getAdminPrincipalForUser } from "@/lib/admin/permissions";
import {
  isProtocolReturnPath,
  waitlistAuthLoginPath,
  waitlistEnrollmentContext,
} from "@/lib/waitlist/auth-join";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const returnTo = safeIdentityReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  );
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    if (request.nextUrl.searchParams.get("from") === "waitlist")
      return NextResponse.redirect(
        new URL(
          waitlistAuthLoginPath(request.nextUrl.searchParams),
          request.url
        )
      );
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login);
  }
  let destination = "/access-pending";
  try {
    const canonical = await resolveProviderIdentity(identity);
    await enrollAuthenticatedUser(
      identity,
      canonical,
      request.nextUrl.searchParams.get("from") === "waitlist"
        ? waitlistEnrollmentContext(request.nextUrl.searchParams)
        : undefined
    );
    const decision = await getAccessDecision(canonical.userId);
    if (decision.state === "approved")
      destination = (await getAdminPrincipalForUser(canonical.userId))
        ? "/admin"
        : "/home";
    if (returnTo === "/waitlist") destination = "/waitlist";
  } catch (error) {
    console.error("identity_sync_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
  return NextResponse.redirect(
    new URL(
      isProtocolReturnPath(returnTo) ? returnTo : destination,
      request.url
    )
  );
}
