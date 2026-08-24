import "server-only";

import { PmtHouseClient, PmtHouseError } from "@pymthouse/builder-sdk";
import {
  readPublicClientId,
  requirePymthouseM2mConfig,
} from "@/lib/console/pymthouse-http";

export function createPmtHouseClientForPublicApp(
  publicClientId: string
): PmtHouseClient {
  const config = requirePymthouseM2mConfig();
  return new PmtHouseClient({
    issuerUrl: config.issuerUrl,
    publicClientId,
    m2mClientId: config.m2mClientId,
    m2mClientSecret: config.m2mClientSecret,
    allowInsecureHttp: config.allowInsecureHttp,
  });
}

/**
 * Pymthouse signals user-not-found with two envelopes: the REST shape
 * (`{ error: <prose>, code: "not_found" }`) and the OAuth shape used by the
 * mint-token route (`{ error: "not_found" }`, no `code`).
 */
export function isUserNotFoundError(error: unknown): boolean {
  if (!(error instanceof PmtHouseError) || error.status !== 404) {
    return false;
  }
  if (error.code === "not_found") {
    return true;
  }
  const details = error.details as { error?: unknown } | null | undefined;
  return details?.error === "not_found";
}

export async function ensureDashboardAppUser(
  externalUserId: string,
  email?: string
): Promise<void> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  await client.upsertAppUser({
    externalUserId,
    ...(email ? { email } : {}),
  });
}

export async function mintEndUserAccessToken(
  externalUserId: string,
  email?: string
): Promise<string> {
  const client = createPmtHouseClientForPublicApp(readPublicClientId());
  try {
    const minted = await client.mintUserAccessToken({ externalUserId });
    return minted.access_token;
  } catch (error) {
    if (isUserNotFoundError(error)) {
      await ensureDashboardAppUser(externalUserId, email);
      const minted = await client.mintUserAccessToken({ externalUserId });
      return minted.access_token;
    }
    throw error;
  }
}
