import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { captureEmailVerified } from "@/lib/analytics-server";
import { getDb } from "@/lib/db";
import {
  pointEvents,
  verificationTokens,
  waitlistSignups,
} from "@/lib/db/schema";
import { analyticsMemberId, hashToken } from "@/lib/waitlist/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) redirect("/waitlist?verification=invalid");

  const db = getDb();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [verification] = await tx
      .select({
        id: verificationTokens.id,
        signupId: verificationTokens.signupId,
        requestedMarketingConsent: verificationTokens.requestedMarketingConsent,
      })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.tokenHash, hashToken(token)),
          isNull(verificationTokens.consumedAt),
          gt(verificationTokens.expiresAt, now)
        )
      )
      .limit(1);
    if (!verification) return null;

    const [signup] = await tx
      .select()
      .from(waitlistSignups)
      .where(eq(waitlistSignups.id, verification.signupId))
      .for("update")
      .limit(1);
    if (!signup || !["pending", "confirmed"].includes(signup.status))
      return null;
    // Signup-first lock order matches token issuance and preference mutations.
    const [validToken] = await tx
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.id, verification.id),
          isNull(verificationTokens.consumedAt),
          gt(verificationTokens.expiresAt, now)
        )
      )
      .for("update")
      .limit(1);
    if (!validToken) return null;

    await tx
      .update(verificationTokens)
      .set({ consumedAt: now })
      .where(eq(verificationTokens.id, verification.id));
    await tx
      .update(waitlistSignups)
      .set({
        status: "confirmed",
        confirmedAt: now,
      })
      .where(
        and(
          eq(waitlistSignups.id, signup.id),
          eq(waitlistSignups.status, "pending")
        )
      );
    // Legacy links confirm only their original record; Auth0 now owns sessions
    // and authenticated preference changes. Never replay old requested consent.

    if (signup.referredBy && signup.referredBy !== signup.id) {
      await tx
        .insert(pointEvents)
        .values({
          id: randomUUID(),
          signupId: signup.referredBy,
          points: 1,
          reason: "verified_referral",
          referralSignupId: signup.id,
        })
        .onConflictDoNothing({
          target: [pointEvents.reason, pointEvents.referralSignupId],
        });
    }

    return {
      analyticsId: analyticsMemberId(signup.id),
      verificationId: verification.id,
    };
  });

  if (!result) redirect("/waitlist?verification=invalid");
  after(async () => {
    try {
      await captureEmailVerified(result);
    } catch (error) {
      console.error("waitlist_verification_analytics_failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }
  });
  redirect("/waitlist?verification=confirmed");
}
