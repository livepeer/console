import "server-only";
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { enrollAuthenticatedUser } from "@/lib/access/enrollment";
import { getAccessDecision } from "@/lib/access/service";
import { getAdminPrincipalForUser } from "@/lib/admin/permissions";
import { consoleSignInHref, safeReturnTo } from "@/lib/console/auth-login";
import { isProtocolReturnPath } from "@/lib/identity/sync-return";

/** Post-Auth0 / already-signed-in destination. Pages redirect; no extra route. */
export async function signedInLandingPath(
  requestedReturnTo: string
): Promise<string> {
  const returnTo = safeReturnTo(requestedReturnTo);
  const identity = await getAuthenticatedIdentity();
  if (!identity) return consoleSignInHref({ returnTo });
  let destination = "/access-pending";
  try {
    const canonical = await resolveProviderIdentity(identity);
    await enrollAuthenticatedUser(identity, canonical);
    const decision = await getAccessDecision(canonical.userId);
    if (decision.state === "approved")
      destination = (await getAdminPrincipalForUser(canonical.userId))
        ? "/admin"
        : "/home";
    if (returnTo === "/waitlist") destination = "/waitlist";
  } catch (error) {
    console.error("signed_in_landing_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
  return isProtocolReturnPath(returnTo) ? returnTo : destination;
}
