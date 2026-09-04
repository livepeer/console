import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { hashToken, SESSION_COOKIE } from "@/lib/waitlist/security";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await getDb()
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(rawToken)));
  }
  cookieStore.delete(SESSION_COOKIE);
  return Response.json({ message: "Signed out." });
}
