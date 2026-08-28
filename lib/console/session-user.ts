import "server-only";

import { auth0 } from "@/lib/auth0";
import { externalUserIdFromSub } from "@/lib/console/external-user-id";

export class SessionRequiredError extends Error {
  readonly status = 401;
  readonly code = "unauthorized";

  constructor(message = "Sign in required") {
    super(message);
    this.name = "SessionRequiredError";
  }
}

export async function requireConsoleSession(): Promise<{
  externalUserId: string;
  email?: string;
}> {
  const session = await auth0.getSession();
  const sub = session?.user?.sub?.trim();
  if (!session || !sub) {
    throw new SessionRequiredError();
  }
  const email = session.user.email?.trim();
  return {
    externalUserId: await externalUserIdFromSub(sub),
    email: email || undefined,
  };
}
