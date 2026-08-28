import "server-only";

import {
  createSignerTokenManager,
  mintUserSignerToken,
  type CachedSignerToken,
} from "@pymthouse/builder-sdk/signer/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { createPmtHouseClientForPublicApp } from "@/lib/console/pymthouse-bff";
import {
  readPublicClientId,
  readPymthouseM2mConfig,
  requirePymthouseM2mConfig,
} from "@/lib/console/pymthouse-http";

export type SignerContext = {
  jwt: string;
  signerUrl: string | undefined;
  balanceUsdMicros: string;
  lifetimeGrantedUsdMicros: string;
  expiresAt: number;
};

const SIGNER_ROUTING_TTL_MS = 5 * 60 * 1000;

type CachedSignerRouting = {
  signerUrl: string;
  fetchedAt: number;
};

const signerRoutingByClient = new Map<string, CachedSignerRouting>();

function isPymthouseConfigured(): boolean {
  if (readPymthouseM2mConfig() === null) return false;
  try {
    readPublicClientId();
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the public signer DMZ URL from issuer app routing
 * (`GET …/apps/{clientId}/signer/routing`) — not from dashboard env.
 */
async function resolveSignerUrl(
  publicClientId: string
): Promise<string | undefined> {
  const now = Date.now();
  const cached = signerRoutingByClient.get(publicClientId);
  if (cached && now - cached.fetchedAt < SIGNER_ROUTING_TTL_MS) {
    return cached.signerUrl;
  }

  const client = createPmtHouseClientForPublicApp(publicClientId);
  const routing = await client.getSignerRouting();
  const signerUrl =
    routing.routing?.signerApiUrl?.trim() ||
    routing.patterns?.directDmz?.signerApiUrl?.trim() ||
    "";
  if (!signerUrl) {
    return undefined;
  }
  signerRoutingByClient.set(publicClientId, { signerUrl, fetchedAt: now });
  return signerUrl;
}

const tokenManager = createSignerTokenManager({
  mint: async (publicClientId, externalUserId) => {
    const config = requirePymthouseM2mConfig();
    createPmtHouseClientForPublicApp(publicClientId);
    return mintUserSignerToken({
      issuerUrl: config.issuerUrl,
      m2mClientId: config.m2mClientId,
      m2mClientSecret: config.m2mClientSecret,
      externalUserId,
      allowInsecureHttp: config.allowInsecureHttp,
    });
  },
});

function toSignerContext(
  token: CachedSignerToken,
  signerUrl: string | undefined
): SignerContext {
  return {
    jwt: token.jwt,
    signerUrl,
    balanceUsdMicros: token.balanceUsdMicros,
    lifetimeGrantedUsdMicros: token.lifetimeGrantedUsdMicros,
    expiresAt: token.expiresAt,
  };
}

export function isRunnerSignerConfigured(): boolean {
  return isPymthouseConfigured();
}

export async function getSignerContext(
  externalUserId: string,
  options?: { forceRefresh?: boolean }
): Promise<SignerContext> {
  const trimmed = externalUserId.trim();
  if (!trimmed) {
    throw new PmtHouseError("externalUserId is required", {
      status: 400,
      code: "invalid_external_user_id",
    });
  }
  const publicClientId = readPublicClientId();
  const [token, signerUrl] = await Promise.all([
    tokenManager.getToken(publicClientId, trimmed, {
      forceRefresh: options?.forceRefresh,
    }),
    resolveSignerUrl(publicClientId),
  ]);
  return toSignerContext(token, signerUrl);
}

export async function getSignerSessionStatus(externalUserId: string): Promise<{
  ready: boolean;
  expiresIn: number;
  balanceUsdMicros: string;
  lifetimeGrantedUsdMicros: string;
  /** Short-lived signer JWT — embedded hidden in the playground for live runs. */
  jwt: string;
}> {
  const context = await getSignerContext(externalUserId);
  const expiresIn = Math.max(
    1,
    Math.floor((context.expiresAt - Date.now()) / 1000)
  );
  return {
    ready: true,
    expiresIn,
    balanceUsdMicros: context.balanceUsdMicros,
    lifetimeGrantedUsdMicros: context.lifetimeGrantedUsdMicros,
    jwt: context.jwt,
  };
}
