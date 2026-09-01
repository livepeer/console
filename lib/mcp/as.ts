import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function asSecret(): string {
  const value =
    process.env.MCP_AS_SECRET?.trim() ||
    process.env.MCP_OAUTH_BRIDGE_SECRET?.trim() ||
    process.env.MCP_INTERNAL_MINT_SECRET?.trim() ||
    process.env.AUTH0_SECRET?.trim() ||
    "";
  if (!value) {
    throw new Error("MCP_AS_SECRET (or MCP_OAUTH_BRIDGE_SECRET / AUTH0_SECRET) is required");
  }
  return value;
}

function signPayload(payload: string): string {
  const sig = createHmac("sha256", asSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySignedPayload(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", asSecret()).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  return payload;
}

function encodeJson(value: unknown): string {
  return signPayload(Buffer.from(JSON.stringify(value), "utf8").toString("base64url"));
}

function decodeJson<T>(value: string): T | null {
  const payload = verifySignedPayload(value);
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const PKCE_COOKIE = "lp_mcp_pkce";
const CLIENT_PREFIX = "mcp_c_";
const AUTH_CODE_PREFIX = "mcp_ac_";
const PENDING_TTL_MS = 10 * 60 * 1000;
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

export type DcrClient = {
  redirectUris: string[];
  issuedAt: number;
};

export type PkcePending = {
  nonce: string;
  clientId: string;
  clientState: string;
  redirectUri: string;
  codeChallenge: string;
  exp: number;
};

export type AuthCodeGrant = {
  identityCode?: string;
  redirectUri: string;
  codeChallenge: string;
  clientId: string;
  externalUserId?: string;
  email?: string;
  exp: number;
};

export function issueClientId(redirectUris: string[]): string {
  return `${CLIENT_PREFIX}${encodeJson({
    ru: redirectUris,
    iat: Math.floor(Date.now() / 1000)
  })}`;
}

export function parseClientId(clientId: string | undefined): DcrClient | null {
  const trimmed = clientId?.trim() ?? "";
  if (!trimmed.startsWith(CLIENT_PREFIX)) return null;
  const parsed = decodeJson<{ ru?: unknown; iat?: unknown }>(
    trimmed.slice(CLIENT_PREFIX.length)
  );
  if (!parsed || !Array.isArray(parsed.ru) || typeof parsed.iat !== "number") {
    return null;
  }
  const redirectUris = parsed.ru.filter(
    (uri): uri is string => typeof uri === "string" && uri.length > 0
  );
  if (redirectUris.length === 0) return null;
  return { redirectUris, issuedAt: parsed.iat };
}

export function newNonce(): string {
  return randomBytes(16).toString("base64url");
}

export function issuePending(input: {
  nonce: string;
  clientId: string;
  clientState: string;
  redirectUri: string;
  codeChallenge: string;
}): string {
  const pending: PkcePending = {
    ...input,
    exp: Date.now() + PENDING_TTL_MS
  };
  return encodeJson(pending);
}

export function parsePending(value: string | undefined): PkcePending | null {
  if (!value) return null;
  const parsed = decodeJson<PkcePending>(value);
  if (
    !parsed ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.clientId !== "string" ||
    typeof parsed.clientState !== "string" ||
    typeof parsed.redirectUri !== "string" ||
    typeof parsed.codeChallenge !== "string" ||
    typeof parsed.exp !== "number" ||
    parsed.exp < Date.now()
  ) {
    return null;
  }
  return parsed;
}

export function issueAuthCode(grant: Omit<AuthCodeGrant, "exp">): string {
  return `${AUTH_CODE_PREFIX}${encodeJson({
    ...grant,
    exp: Date.now() + AUTH_CODE_TTL_MS
  })}`;
}

export function parseAuthCode(code: string | undefined): AuthCodeGrant | null {
  const trimmed = code?.trim() ?? "";
  if (!trimmed.startsWith(AUTH_CODE_PREFIX)) return null;
  const parsed = decodeJson<AuthCodeGrant>(
    trimmed.slice(AUTH_CODE_PREFIX.length)
  );
  if (
    !parsed ||
    typeof parsed.redirectUri !== "string" ||
    typeof parsed.codeChallenge !== "string" ||
    typeof parsed.clientId !== "string" ||
    typeof parsed.exp !== "number" ||
    parsed.exp < Date.now()
  ) {
    return null;
  }
  const identityCode =
    typeof parsed.identityCode === "string" && parsed.identityCode
      ? parsed.identityCode
      : undefined;
  const externalUserId =
    typeof parsed.externalUserId === "string" && parsed.externalUserId
      ? parsed.externalUserId
      : undefined;
  if (!identityCode && !externalUserId) return null;
  return {
    ...parsed,
    identityCode,
    externalUserId
  };
}

export function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("base64url");
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  return sha256Base64Url(verifier) === challenge;
}

export function pkceCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  };
}
