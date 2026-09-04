import { cookies } from "next/headers";

import { getSignupForSession } from "@/lib/waitlist/queries";
import { SESSION_COOKIE } from "@/lib/waitlist/security";
import { getAdminPrincipal } from "@/lib/admin/auth";

export async function getAdminSession() {
  try {
    const rawToken = (await cookies()).get(SESSION_COOKIE)?.value;
    const current = await getSignupForSession(rawToken);
    return current && (await getAdminPrincipal()) ? current : null;
  } catch (error) {
    console.error("waitlist_admin_session_lookup_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
