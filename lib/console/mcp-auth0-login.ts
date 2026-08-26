import type { AuthorizationParameters } from "@auth0/nextjs-auth0/types";

export const AUTH0_MCP_AUDIENCE_DEFAULT = "https://api.livepeer.org/pymthouse";
export const AUTH0_MCP_SCOPES_DEFAULT = "openid profile email sign:job";

/** Must stay equal to MCP_OAUTH_COMPLETE_PATH in mcp-oauth-login-bridge.ts */
export const MCP_AUTH0_RETURN_TO = "/api/v1/auth/mcp/complete";

/** Auth0 `/authorize` extras for the MCP login hop only — not dashboard login. */
export function mcpAuth0AuthorizationParameters(
  env: NodeJS.ProcessEnv = process.env
): AuthorizationParameters {
  const audience = env.AUTH0_MCP_AUDIENCE?.trim();
  if (!audience) {
    return {};
  }
  return {
    audience,
    scope: env.AUTH0_MCP_SCOPES?.trim() || AUTH0_MCP_SCOPES_DEFAULT,
    prompt: "consent",
  };
}

export function isMcpAuth0ReturnTo(returnTo: string): boolean {
  return returnTo === MCP_AUTH0_RETURN_TO;
}

export function mcpAuth0LoginHref(input: { connection?: string } = {}): string {
  const query = new URLSearchParams();
  if (input.connection) {
    query.set("connection", input.connection);
  }
  const suffix = query.toString();
  return suffix ? `/api/v1/auth/mcp/login?${suffix}` : "/api/v1/auth/mcp/login";
}
