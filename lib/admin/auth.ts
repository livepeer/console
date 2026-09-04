import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { adminRoleGrants, users } from "@/lib/db/schema";
import type { AdminPrincipal } from "@/lib/platform/contracts";
import { getSignupForSession } from "@/lib/waitlist/queries";
import { SESSION_COOKIE } from "@/lib/waitlist/security";

export async function getAdminPrincipal(): Promise<AdminPrincipal | null> {
  const current = await getSignupForSession(
    (await cookies()).get(SESSION_COOKIE)?.value
  );
  if (!current) return null;
  if (current.signup.userId) {
    const [user] = await getDb()
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, current.signup.userId))
      .limit(1);
    if (!user || user.status === "disabled") return null;
  }
  const [grant] = await getDb()
    .select()
    .from(adminRoleGrants)
    .where(
      and(
        eq(adminRoleGrants.signupId, current.signup.id),
        eq(adminRoleGrants.role, "admin"),
        isNull(adminRoleGrants.revokedAt)
      )
    )
    .limit(1);
  return grant
    ? {
        adminGrantId: grant.id,
        signupId: current.signup.id,
        ...(current.signup.userId ? { userId: current.signup.userId } : {}),
      }
    : null;
}
