import { redirect } from "next/navigation";
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { consoleSignInHref, safeReturnTo } from "@/lib/console/auth-login";
import { requireConsoleSession } from "@/lib/console/session-user";
import { WaitingContent, type WaitingState } from "./content";

export const dynamic = "force-dynamic";

export default async function AccessPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const requested = safeReturnTo(params.returnTo);
  const returnTo = requested.startsWith("/access-pending")
    ? "/home"
    : requested;
  let approved = false;
  let unauthenticated = false;
  let state: WaitingState = "unavailable";
  try {
    await requireConsoleSession();
    approved = true;
  } catch (error) {
    const failure = error as { status?: number; code?: string } | null;
    unauthenticated = failure?.status === 401;
    if (failure?.code === "access_pending") {
      state = "pending";
      try {
        const identity = await getAuthenticatedIdentity();
        if (identity && (!identity.emailVerified || !identity.email))
          state = "verify-email";
      } catch {
        state = "unavailable";
      }
    } else if (failure?.code === "access_revoked") state = "revoked";
    else if (
      failure?.code === "access_disabled" ||
      failure?.code === "canonical_user_disabled"
    )
      state = "disabled";
  }
  if (unauthenticated) redirect(consoleSignInHref({ returnTo }));
  if (approved) redirect(returnTo);
  return (
    <WaitingContent
      state={state}
      retryHref={`/access-pending?returnTo=${encodeURIComponent(returnTo)}`}
    />
  );
}
