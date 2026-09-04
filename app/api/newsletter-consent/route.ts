import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { consentEvents, emailOutbox, waitlistSignups } from "@/lib/db/schema";
import {
  dispatchOutboxEvent,
  newsletterConsentOutboxValues,
} from "@/lib/email/outbox";
import { NEWSLETTER_CONSENT_VERSION } from "@/lib/waitlist/contracts";
import { getSignupForSession } from "@/lib/waitlist/queries";
import { SESSION_COOKIE } from "@/lib/waitlist/security";

export const runtime = "nodejs";

const consentSchema = z.object({ newsletterOptIn: z.boolean() });

export async function PUT(request: Request) {
  const rawToken = (await cookies()).get(SESSION_COOKIE)?.value;
  const current = await getSignupForSession(rawToken);
  if (!current) {
    return Response.json(
      { message: "Authentication required." },
      { status: 401 }
    );
  }

  let parsed: z.infer<typeof consentSchema>;
  try {
    parsed = consentSchema.parse(await request.json());
  } catch {
    return Response.json({ message: "Invalid preference." }, { status: 400 });
  }

  const outboxEventId = await getDb().transaction(async (tx) => {
    await tx
      .update(waitlistSignups)
      .set({ marketingConsent: parsed.newsletterOptIn })
      .where(eq(waitlistSignups.id, current.signup.id));
    const [consentEvent] = await tx
      .insert(consentEvents)
      .values({
        signupId: current.signup.id,
        purpose: "product_marketing",
        granted: parsed.newsletterOptIn,
        disclosureVersion: NEWSLETTER_CONSENT_VERSION,
        source: "home_panel",
      })
      .returning({ id: consentEvents.id });
    const [outboxEvent] = await tx
      .insert(emailOutbox)
      .values(
        newsletterConsentOutboxValues({
          signupId: current.signup.id,
          consentEventId: consentEvent.id,
          email: current.signup.email,
          subscribed: parsed.newsletterOptIn,
        })
      )
      .onConflictDoNothing({ target: emailOutbox.idempotencyKey })
      .returning({ id: emailOutbox.id });
    return outboxEvent?.id;
  });

  if (outboxEventId) {
    try {
      await dispatchOutboxEvent(outboxEventId);
    } catch (error) {
      console.error("newsletter_immediate_dispatch_failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return Response.json({ newsletterOptIn: parsed.newsletterOptIn });
}
