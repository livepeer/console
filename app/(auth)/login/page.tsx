import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { authLoginHref } from "@/lib/console/auth-login";
import LoginPage from "@/components/console/LoginPage";

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
  const returnTo = params.returnTo ?? "/home";

  const session = await auth0.getSession();
  if (session) {
    redirect(mcpOauth ? MCP_CALLBACK_PATH : "/home");
  }

  // MCP flow must go directly to Auth0 — no interactive UI step.
  if (mcpOauth) {
    redirect(authLoginHref({ returnTo: MCP_CALLBACK_PATH }));
  }

  return <LoginPage mode="signin" returnTo={returnTo} />;
}
