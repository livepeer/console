import { pymthouseSignerUrl } from "./env";
import type { McpPrincipal } from "./jwt";
import { exchangeMcpSignerSession } from "@/lib/console/mcp-internal-mint";

export type SignerSession = {
  access_token: string;
  expires_in: number;
  signer_url: string;
  discovery_url?: string;
};

export type ResolvedSignerSession = SignerSession & { discovery_url: string };

/** `{signer}/discover-orchestrators` — same rule as PymtHouse getSignerDiscoveryUrl. */
export function discoverOrchestratorsUrl(signerUrl: string): string {
  const parsed = new URL(signerUrl.trim());
  parsed.search = "";
  parsed.hash = "";
  let basePath = parsed.pathname;
  while (basePath.length > 1 && basePath.endsWith("/")) {
    basePath = basePath.slice(0, -1);
  }
  if (basePath === "/") {
    basePath = "";
  }
  parsed.pathname = `${basePath}/discover-orchestrators`;
  return parsed.toString();
}

export function resolveDiscoveryUrl(
  session: Pick<SignerSession, "signer_url" | "discovery_url">
): string {
  const explicit = session.discovery_url?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  return discoverOrchestratorsUrl(session.signer_url);
}

export async function exchangeUserJwtForSignerJwt(
  principal: McpPrincipal
): Promise<SignerSession> {
  const session = await exchangeMcpSignerSession({
    accessToken: principal.token
  });
  return {
    access_token: session.access_token,
    expires_in: session.expires_in ?? 300,
    signer_url: session.signer_url || pymthouseSignerUrl(),
    discovery_url: session.discovery_url
  };
}

/** SignerSession first; discovery_url is always the catalog GET target. Never Railway. */
export async function resolveSignerSession(
  principal: McpPrincipal
): Promise<ResolvedSignerSession> {
  const session = await exchangeUserJwtForSignerJwt(principal);
  return {
    ...session,
    discovery_url: resolveDiscoveryUrl(session)
  };
}
