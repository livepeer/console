import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { getAdminPrincipalForUser } from "@/lib/admin/permissions";
import { getDb } from "@/lib/db";
import { waitlistSignups } from "@/lib/db/schema";
import { getMember } from "@/lib/waitlist/queries";
import type { WaitlistSessionResponse } from "@/lib/waitlist/contracts";

export async function getAuthenticatedWaitlistSignup() {
  const identity = await getAuthenticatedIdentity();
  if (!identity) return null;
  const canonical = await resolveProviderIdentity(identity);
  if (canonical.accountStatus !== "active") return null;
  // Membership reads never enroll: a background fetch must not consume the
  // first enrollment before the explicit join carries referral/attribution.
  const [signup] = await getDb()
    .select()
    .from(waitlistSignups)
    .where(
      and(
        eq(waitlistSignups.userId, canonical.userId),
        eq(waitlistSignups.status, "confirmed"),
        isNotNull(waitlistSignups.confirmedAt)
      )
    )
    .limit(1);
  return signup ? { signup, userId: canonical.userId } : null;
}

export async function getCurrentWaitlistSession(): Promise<WaitlistSessionResponse | null> {
  const current = await getAuthenticatedWaitlistSignup();
  if (!current) return null;
  const member = await getMember(current.signup);
  member.accountRole = (await getAdminPrincipalForUser(current.userId))
    ? "admin"
    : "member";
  return { member };
}
