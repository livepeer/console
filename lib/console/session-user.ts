import "server-only";

import { auth0 } from "@/lib/auth0";
import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import {
  syncCanonicalUser,
  syncCanonicalUserBestEffort,
} from "@/lib/identity/canonical-user";

export class SessionRequiredError extends Error {
  readonly status = 401;
  readonly code = "unauthorized";

  constructor(message = "Sign in required") {
    super(message);
    this.name = "SessionRequiredError";
  }
}

export class CanonicalUserUnavailableError extends Error {
  readonly status = 503;
  readonly code = "canonical_user_unavailable";

  constructor(message = "User profile is temporarily unavailable") {
    super(message);
    this.name = "CanonicalUserUnavailableError";
  }
}

export async function requireConsoleSession(): Promise<{
  externalUserId: string;
  canonicalUserId?: string;
  email?: string;
}> {
  const session = await auth0.getSession();
  const sub = session?.user?.sub?.trim();
  if (!session || !sub) {
    throw new SessionRequiredError();
  }
  const email = session.user.email?.trim();
  const canonical = await syncCanonicalUserBestEffort({
    sub,
    email: email || undefined,
    emailVerified: session.user.email_verified === true,
  });
  return {
    externalUserId: await externalUserIdFromSub(sub),
    ...(canonical ? { canonicalUserId: canonical.userId } : {}),
    email: email || undefined,
  };
}

export async function requireCanonicalUser(): Promise<{
  userId: string;
  externalUserId: string;
  email?: string;
}> {
  const session = await auth0.getSession();
  const sub = session?.user?.sub?.trim();
  if (!session || !sub) throw new SessionRequiredError();

  const email = session.user.email?.trim();
  try {
    const canonical = await syncCanonicalUser({
      sub,
      email: email || undefined,
      emailVerified: session.user.email_verified === true,
    });
    return {
      userId: canonical.userId,
      externalUserId: canonical.externalUserId,
      email: email || undefined,
    };
  } catch (error) {
    console.error("canonical_user_required_sync_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    throw new CanonicalUserUnavailableError();
  }
}
