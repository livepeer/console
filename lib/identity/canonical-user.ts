import "server-only";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import { getDb } from "@/lib/db";
import {
  authIdentities,
  userEmails,
  users,
  waitlistSignups,
} from "@/lib/db/schema";
import {
  authProviderFromSub,
  chooseCanonicalUserId,
  normalizeIdentityEmail,
  waitlistLinkDecision,
} from "@/lib/identity/canonical-user-policy";
import { runBestEffortIdentitySync } from "@/lib/identity/best-effort-sync";

export type Auth0IdentityInput = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
};

export type CanonicalUserSyncResult = {
  userId: string;
  accountStatus: "active" | "disabled";
  externalUserId: string;
  identityCreated: boolean;
  waitlistLinked: boolean;
  conflicts: Array<"verified_email" | "waitlist_link">;
};

export async function syncCanonicalUser(
  input: Auth0IdentityInput
): Promise<CanonicalUserSyncResult> {
  const providerSubject = input.sub.trim();
  if (!providerSubject) throw new Error("Auth0 sub is required");

  const provider = authProviderFromSub(providerSubject);
  const externalUserId = await externalUserIdFromSub(providerSubject);
  const email = input.email?.trim() || null;
  const normalizedEmail = normalizeIdentityEmail(email ?? undefined);
  const verifiedEmail = Boolean(normalizedEmail && input.emailVerified);
  const now = new Date();

  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${provider}:${providerSubject}`}, 0))`
    );
    if (verifiedEmail) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`email:${normalizedEmail}`}, 0))`
      );
    }

    const [existingIdentity] = await tx
      .select({ userId: authIdentities.userId })
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, provider),
          eq(authIdentities.providerSubject, providerSubject)
        )
      )
      .limit(1);

    let verifiedEmailUserId: string | undefined;
    if (!existingIdentity && verifiedEmail && normalizedEmail) {
      const [emailOwner] = await tx
        .select({ userId: userEmails.userId })
        .from(userEmails)
        .where(
          and(
            eq(userEmails.normalizedEmail, normalizedEmail),
            isNotNull(userEmails.verifiedAt)
          )
        )
        .limit(1);
      verifiedEmailUserId = emailOwner?.userId;
    }

    let userId = chooseCanonicalUserId({
      identityUserId: existingIdentity?.userId,
      verifiedEmailUserId,
    });

    let accountStatus: "active" | "disabled";
    if (!userId) {
      const [createdUser] = await tx
        .insert(users)
        .values({ lastSeenAt: now, updatedAt: now })
        .returning({ id: users.id, status: users.status });
      userId = createdUser.id;
      accountStatus = createdUser.status;
    } else {
      const [updatedUser] = await tx
        .update(users)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(users.id, userId))
        .returning({ status: users.status });
      accountStatus = updatedUser.status;
    }

    const identityCreated = !existingIdentity;
    if (identityCreated) {
      await tx.insert(authIdentities).values({
        userId,
        provider,
        providerSubject,
        providerMetadata: { authority: "auth0", strategy: provider },
        externalUserId,
        lastSeenAt: now,
      });
    } else {
      await tx
        .update(authIdentities)
        .set({
          externalUserId,
          providerMetadata: { authority: "auth0", strategy: provider },
          lastSeenAt: now,
        })
        .where(
          and(
            eq(authIdentities.provider, provider),
            eq(authIdentities.providerSubject, providerSubject)
          )
        );
    }

    const conflicts: CanonicalUserSyncResult["conflicts"] = [];
    let emailMayLinkWaitlist = verifiedEmail;

    if (email && normalizedEmail) {
      const [verifiedOwner] = verifiedEmail
        ? await tx
            .select({ userId: userEmails.userId })
            .from(userEmails)
            .where(
              and(
                eq(userEmails.normalizedEmail, normalizedEmail),
                isNotNull(userEmails.verifiedAt)
              )
            )
            .limit(1)
        : [];

      if (verifiedOwner && verifiedOwner.userId !== userId) {
        conflicts.push("verified_email");
        emailMayLinkWaitlist = false;
      } else {
        await tx
          .update(userEmails)
          .set({ isPrimary: false, updatedAt: now })
          .where(eq(userEmails.userId, userId));
        await tx
          .insert(userEmails)
          .values({
            userId,
            email,
            normalizedEmail,
            source: "auth0",
            isPrimary: true,
            verifiedAt: verifiedEmail ? now : null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [userEmails.userId, userEmails.normalizedEmail],
            set: {
              email,
              source: "auth0",
              isPrimary: true,
              ...(verifiedEmail ? { verifiedAt: now } : {}),
              updatedAt: now,
            },
          });
      }
    }

    let waitlistLinked = false;
    if (emailMayLinkWaitlist && normalizedEmail) {
      const [waitlistEntry] = await tx
        .select({ id: waitlistSignups.id, userId: waitlistSignups.userId })
        .from(waitlistSignups)
        .where(
          and(
            eq(waitlistSignups.normalizedEmail, normalizedEmail),
            eq(waitlistSignups.status, "confirmed")
          )
        )
        .limit(1)
        .for("update");

      const [existingUserEntry] = await tx
        .select({ id: waitlistSignups.id })
        .from(waitlistSignups)
        .where(eq(waitlistSignups.userId, userId))
        .limit(1);

      const linkDecision = waitlistLinkDecision({
        emailVerified: verifiedEmail,
        emailConflict: !emailMayLinkWaitlist,
        userId,
        waitlistUserId: waitlistEntry?.userId,
        waitlistExists: Boolean(waitlistEntry),
      });
      if (
        linkDecision === "conflict" ||
        (linkDecision === "link" &&
          existingUserEntry &&
          existingUserEntry.id !== waitlistEntry?.id)
      ) {
        conflicts.push("waitlist_link");
      } else if (linkDecision === "link" && waitlistEntry) {
        const linked = await tx
          .update(waitlistSignups)
          .set({ userId })
          .where(
            and(
              eq(waitlistSignups.id, waitlistEntry.id),
              isNull(waitlistSignups.userId)
            )
          )
          .returning({ id: waitlistSignups.id });
        waitlistLinked = linked.length === 1;
      }
    }

    return {
      userId,
      accountStatus,
      externalUserId,
      identityCreated,
      waitlistLinked,
      conflicts,
    };
  });
}

export async function syncCanonicalUserBestEffort(
  input: Auth0IdentityInput
): Promise<CanonicalUserSyncResult | null> {
  const result = await runBestEffortIdentitySync(
    () => syncCanonicalUser(input),
    (error) => {
      console.error("canonical_user_sync_failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }
  );
  if (result?.conflicts.length) {
    console.warn("canonical_user_sync_conflict", {
      externalUserId: result.externalUserId,
      conflicts: result.conflicts,
    });
  }
  return result;
}
