import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import LoginPage from "@/components/console/LoginPage";
import {
  decodeMcpOauthPendingCookie,
  MCP_OAUTH_COMPLETE_PATH,
  MCP_OAUTH_PENDING_COOKIE,
  parseMcpOauthLoginQuery
} from "@/lib/console/mcp-oauth-login-bridge";

export default async function LoginRoute({
  searchParams
}: {
  searchParams: Promise<{
    mcp_oauth?: string;
    mcp_bridge?: string;
    state?: string;
    redirect_uri?: string;
  }>;
}) {
  const params = await searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  const requestOrigin = host ? `${proto}://${host}` : undefined;
  if (params.mcp_oauth === "1") {
    const parsed = parseMcpOauthLoginQuery({
      mcpOauth: params.mcp_oauth,
      state: params.state,
      redirectUri: params.redirect_uri,
      requestOrigin
    });
    if (!parsed.ok) {
      redirect("/login");
    }
    const begin = new URLSearchParams({
      state: parsed.pending.state,
      redirect_uri: parsed.pending.redirectUri
    });
    redirect(`/api/v1/auth/mcp/begin?${begin.toString()}`);
  }

  const jar = await cookies();
  const pending = decodeMcpOauthPendingCookie(
    jar.get(MCP_OAUTH_PENDING_COOKIE)?.value,
    requestOrigin
  );
  const mcpBridge = params.mcp_bridge === "1" && pending !== null;

  const session = await auth0.getSession();
  if (session) {
    if (mcpBridge) {
      redirect(MCP_OAUTH_COMPLETE_PATH);
    }
    redirect("/home");
  }

  return (
    <LoginPage returnTo={mcpBridge ? MCP_OAUTH_COMPLETE_PATH : "/home"} />
  );
}
