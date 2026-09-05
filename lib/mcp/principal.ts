import { externalUserIdFromSub } from "@/lib/console/external-user-id";

/**
 * Console sessions always hash Auth0 `sub` to `eu_<sha256>`. MCP tokens that
 * omit `external_user_id` used to fall back to the raw `sub`, so assets and
 * history lived in different namespaces for the same person.
 */
export async function resolveMcpExternalUserId(
  sub: string,
  claimed?: string | null
): Promise<string> {
  const fromToken = claimed?.trim();
  if (fromToken) return fromToken;
  const raw = sub.trim();
  if (!raw) {
    throw new Error("token is missing sub");
  }
  if (raw.includes("|") || raw.includes("/")) {
    return externalUserIdFromSub(raw);
  }
  return raw;
}

export function principalId(principal: {
  externalUserId: string;
  sub: string;
}): string {
  return principal.externalUserId || principal.sub;
}
