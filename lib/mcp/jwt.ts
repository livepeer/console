import * as jose from "jose";
import { pymthouseIssuerUrl, pymthouseJwksUrl } from "./env";

const jwks = jose.createRemoteJWKSet(new URL(pymthouseJwksUrl()));

export type McpPrincipal = {
  sub: string;
  email?: string;
  externalUserId: string;
  publicClientId: string;
  scope: string;
  token: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function scopeFromPayload(payload: jose.JWTPayload): string {
  if (typeof payload.scope === "string") return payload.scope;
  const scp = payload.scp;
  if (Array.isArray(scp)) {
    return scp.filter((s): s is string => typeof s === "string").join(" ");
  }
  return "";
}

export async function verifyMcpUserJwt(token: string): Promise<McpPrincipal> {
  const issuer = pymthouseIssuerUrl();
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer,
    audience: issuer
  });

  const scope = scopeFromPayload(payload);
  if (!scope.split(/[\s,]+/).includes("sign:job")) {
    throw new Error("token is missing sign:job");
  }

  const sub = asString(payload.sub);
  if (!sub) {
    throw new Error("token is missing sub");
  }

  const publicClientId =
    asString(payload.client_id) || asString(payload.azp) || "";

  const externalUserId = asString(payload.external_user_id) || sub;

  return {
    sub,
    email: asString(payload.email),
    externalUserId,
    publicClientId,
    scope,
    token
  };
}

export function extractBearer(authorization: string | null): string | null {
  if (!authorization?.trim()) return null;
  const value = authorization.trim();
  if (value.toLowerCase().startsWith("bearer ")) {
    return value.slice(7).trim() || null;
  }
  return null;
}
