import "server-only";

import {
  createSignerTokenManager,
  mintUserSignerToken,
  type CachedSignerToken,
} from "@pymthouse/builder-sdk/signer/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { createPmtHouseClientForPublicApp } from "@/lib/dashboard/pymthouse-bff";

export type SignerContext = {
  jwt: string;
  signerUrl: string | undefined;
  balanceUsdMicros: string;
  lifetimeGrantedUsdMicros: string;
  expiresAt: number;
};

function readPublicClientId(): string {
  const id =
    process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ||
    process.env.DASHBOARD_DEVICE_PUBLIC_CLIENT_ID?.trim();
  if (!id) {
    throw new PmtHouseError(
      "PYMTHOUSE_PUBLIC_CLIENT_ID (or DASHBOARD_DEVICE_PUBLIC_CLIENT_ID) is required",
      { status: 503, code: "pymthouse_required" },
    );
  }
  return id;
}

function readSignerUrl(): string | undefined {
  return (
    process.env.PYMTHOUSE_CLIENT_SIGNER_API_URL?.trim() ||
    process.env.PYMTHOUSE_SIGNER_URL?.trim() ||
    process.env.SIGNER_PUBLIC_URL?.trim() ||
    undefined
  );
}

function readM2mMintConfig() {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  const m2mClientId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const m2mClientSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  if (!issuerUrl || !m2mClientId || !m2mClientSecret) {
    return null;
  }
  return {
    issuerUrl,
    m2mClientId,
    m2mClientSecret,
    allowInsecureHttp: process.env.PYMTHOUSE_ALLOW_INSECURE_HTTP === "1",
  };
}

function isPymthouseConfigured(): boolean {
  return readM2mMintConfig() !== null && Boolean(readPublicClientId());
}

const tokenManager = createSignerTokenManager({
  mint: async (publicClientId, externalUserId) => {
    const config = readM2mMintConfig();
    if (!config) {
      throw new PmtHouseError(
        "Pymthouse is not configured. Set PYMTHOUSE_ISSUER_URL, PYMTHOUSE_M2M_CLIENT_ID, and PYMTHOUSE_M2M_CLIENT_SECRET.",
        { status: 503, code: "pymthouse_required" },
      );
    }
    // Ensure the public app client exists before minting.
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

function toSignerContext(token: CachedSignerToken): SignerContext {
  return {
    jwt: token.jwt,
    signerUrl: readSignerUrl(),
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
  options?: { forceRefresh?: boolean },
): Promise<SignerContext> {
  const trimmed = externalUserId.trim();
  if (!trimmed) {
    throw new PmtHouseError("externalUserId is required", {
      status: 400,
      code: "invalid_external_user_id",
    });
  }
  const publicClientId = readPublicClientId();
  const token = await tokenManager.getToken(publicClientId, trimmed, {
    forceRefresh: options?.forceRefresh,
  });
  return toSignerContext(token);
}

export async function getSignerSessionStatus(externalUserId: string): Promise<{
  ready: boolean;
  expiresIn: number;
  balanceUsdMicros: string;
  lifetimeGrantedUsdMicros: string;
}> {
  const context = await getSignerContext(externalUserId);
  const expiresIn = Math.max(1, Math.floor((context.expiresAt - Date.now()) / 1000));
  return {
    ready: true,
    expiresIn,
    balanceUsdMicros: context.balanceUsdMicros,
    lifetimeGrantedUsdMicros: context.lifetimeGrantedUsdMicros,
  };
}
