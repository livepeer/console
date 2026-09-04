import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { authLoginHref, safeReturnTo } from "@/lib/console/auth-login";
import LoginPage from "@/components/console/LoginPage";
import { syncCanonicalUserBestEffort } from "@/lib/identity/canonical-user";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Livepeer Early Access",
};

const MCP_CALLBACK_PATH = "/api/mcp/oauth/callback";

export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{
    mcp_oauth?: string;
    returnTo?: string;
  }>;
}) {
  const params = await searchParams;
  const mcpOauth = params.mcp_oauth === "1";
  const returnTo = safeReturnTo(params.returnTo);

  const session = await auth0.getSession();
  if (session) {
    const sub = session.user.sub?.trim();
    if (sub) {
      await syncCanonicalUserBestEffort({
        sub,
        email: session.user.email?.trim() || undefined,
        emailVerified: session.user.email_verified === true,
      });
    }
    redirect(mcpOauth ? MCP_CALLBACK_PATH : returnTo);
  }

  // MCP flow must go directly to Auth0 — no interactive UI step.
  if (mcpOauth) {
    redirect(authLoginHref({ returnTo: MCP_CALLBACK_PATH }));
  }

  return <LoginPage mode="signin" returnTo={returnTo} />;
}
